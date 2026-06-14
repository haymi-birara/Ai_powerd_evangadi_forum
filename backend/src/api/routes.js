import express from "express";
import authRoutes from "./auth/routes/auth.routes.js";
import questionRoutes from "./question/routes/question.routes.js";

import questionRoute from './question/routes/question.routes.js';

export const mainRouter = express.Router();

// Authentication routes
mainRouter.use('/auth', authRoutes);

//  /api/questions
mainRouter.use('/questions', questionRoute);
