import express from 'express';
import authRoutes from './auth/routes/auth.routes.js';
import questionRoutes from './question/routes/question.route.js';

export const mainRouter = express.Router();

// Authentication routes
mainRouter.use('/auth', authRoutes);

// Questions routes
mainRouter.use('/questions', questionRoutes);
