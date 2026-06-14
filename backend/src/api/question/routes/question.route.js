import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";

import {
  getQuestionsController,
  getSingleQuestionController,
} from "../controller/question.controller.js";

import {
  getQuestionsValidation,
  getSingleQuestionValidation,
} from "../validations/question.validation.js";

const router = express.Router();

/**
 * GET /api/questions
 * List questions
 */
router.get(
  "/",
  authenticateUser,
  getQuestionsValidation,
  getQuestionsController,
);

/**
 * GET /api/questions/:questionHash
 * Get single question with answers
 */
router.get(
  "/:questionHash",
  authenticateUser,
  getSingleQuestionValidation,
  getSingleQuestionController,
);

export default router;
