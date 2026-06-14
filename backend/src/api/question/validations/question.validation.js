import { param, query } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

export const getQuestionsValidation = [
  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim(),

  query("mine")
    .optional()
    .isBoolean()
    .withMessage("Mine must be a boolean")
    .toBoolean(),

  validationErrorHandler,
];

export const getSingleQuestionValidation = [
  param("questionHash")
    .notEmpty()
    .withMessage("Question hash is required")
    .bail()
    .isString()
    .withMessage("Question hash must be a string")
    .bail()
    .matches(/^[a-f0-9]{16}$/)
    .withMessage("Question hash must be a 16-character lowercase hex string"),

  validationErrorHandler,
];
