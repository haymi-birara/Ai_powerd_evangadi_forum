import { body, param } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

export const createReplyValidation = [
  param("answerId")
    .isInt({ min: 1 })
    .withMessage("answerId must be a positive integer")
    .toInt(),

  body("content")
    .notEmpty()
    .withMessage("content is required")
    .isString()
    .withMessage("content must be a string")
    .trim()
    .isLength({ min: 2, max: 5000 })
    .withMessage("content must be between 2 and 5,000 characters long"),

  validationErrorHandler,
];
