// dotenv must be configured before any other import reads process.env.
import dotenv from "dotenv";
dotenv.config(); // Load .env file contents into process.env

import express from 'express';// Express framework for building the API server
import { db } from './db/config.js';// Database connection pool
import { mainRouter } from './src/api/routes.js';// Main router that aggregates all API routes
import { errorHandler } from './src/middleware/error-handler.js';// Centralized error handling middleware

import cors from 'cors'; // Middleware to enable Cross-Origin Resource Sharing (CORS) for frontend-backend communication

const app = express(); // Create an Express application instance
const port = process.env.PORT || 3777; // Server will listen on this port, defaulting to 3777 if not specified in environment variables

// Fail fast at startup rather than crashing mid-request when a secret is missing.
const validateEnv = () => {
  const required = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD'];
  for (const env of required) {
    if (!process.env[env]) {
      throw new Error(`Missing required environment variable: ${env}`);
    }
  }
};

validateEnv();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check — used by load balancers and uptime monitors.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api', mainRouter);// All API routes will be prefixed with /api

// errorHandler must be registered last so it catches errors from all routes.
app.use(errorHandler);

// Holds the http.Server instance so gracefulShutdown can close it explicitly.
let server;

// Start server
const startServer = async () => {
  try {
    // Verify the DB pool can reach the server before accepting traffic.
    const connection = await db.getConnection();
    console.log('Database connection established successfully.');
    connection.release();
    // Capture the server handle so we can call server.close() on shutdown.
    server = app.listen(port, err => {
      if (err) {
        console.error('Failed to start the server:', err.message);
        process.exit(1);
      }
      console.log(`Server running on port http://localhost:${port}`);
    });
  }
  // If the DB connection fails, log the error and exit the process to avoid running a non-functional server.
  catch (error) {
    console.error(
      'Failed to connect to the database. Server not started.',
      error.message,
    );
    process.exit(1);
  }
};

startServer();

// Graceful shutdown on SIGINT (Ctrl+C) or SIGTERM (termination signal).
// server.close() stops accepting new connections and releases the port first,
// then db.end() drains the connection pool before the process exits.
const gracefulShutdown = async () => {
  console.log('Received shutdown signal. Closing server and database connections...');
  await new Promise((resolve) => server.close(resolve)); // Stop accepting new requests and wait for existing ones to finish
  await db.end(); // Close all database connections gracefully
  console.log('Database connections closed. Exiting process.');
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown); //
process.on('SIGTERM', gracefulShutdown);
