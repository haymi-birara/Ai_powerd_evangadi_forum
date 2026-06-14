import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import { createQuestionValidation } from "../Validations/question.validation.js";
import { createQuestionController } from "../controller/question.controller.js";

const questionRoute = express.Router();
questionRoute.post(
  "/",
  authenticateUser,
  createQuestionValidation,
  createQuestionController,
);

export default questionRoute;
