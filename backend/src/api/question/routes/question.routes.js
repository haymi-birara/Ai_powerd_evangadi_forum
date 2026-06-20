import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  createQuestionValidation,
  draftCoachValidation,
  getQuestionsValidation,
  getSimilarQuestionsValidation,
  searchQuestionsValidation,
  getSingleQuestionValidation,
  searchQuestionsValidation,
  similarQuestionsValidation,
} from "../validations/question.validation.js";
import {
  createQuestionController,
  generateQuestionDraftCoachController,
  getSimilarQuestionsController,
  getQuestionsController,
  searchQuestionsSemanticController,
  getSingleQuestionController,
  searchQuestionsSemanticController,
} from "../controller/question.controller.js";

const questionRoute = express.Router();

questionRoute.get("/", authenticateUser, getQuestionsValidation, getQuestionsController);

questionRoute.post("/", authenticateUser, createQuestionValidation, createQuestionController);

questionRoute.post("/draft-coach", authenticateUser, draftCoachValidation, generateQuestionDraftCoachController);

questionRoute.get(
  "/search",
  authenticateUser,
  searchQuestionsValidation,
  searchQuestionsSemanticController,
);

questionRoute.get(
  "/:questionHash/similar",
  authenticateUser,
  getSimilarQuestionsValidation,
  getSimilarQuestionsController,
);

questionRoute.get(
  "/:questionHash",
  authenticateUser,
  getSingleQuestionValidation,
  getSingleQuestionController,
);

export default questionRoute;
