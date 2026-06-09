import express from 'express';
import authRoutes from './auth/routes/auth.routes.js';
import answerFitRoutes from './questions/routes/answer-fit.routes.js';

export const mainRouter = express.Router();

// Authentication routes
mainRouter.use('/auth', authRoutes);
mainRouter.use('/questions', answerFitRoutes);