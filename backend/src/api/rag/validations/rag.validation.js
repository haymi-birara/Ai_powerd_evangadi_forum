import { param, query } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

export const searchInDocumentValidation = [
  param("documentId")
    .notEmpty()
    .withMessage("Document ID is required")
    .isInt({ min: 1 })
    .withMessage("Document ID must be a positive integer")
    .toInt(),

  query("query")
    .notEmpty()
    .withMessage("Search query is required")
    .isString()
    .withMessage("Search query must be a string")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Search query must be between 1 and 500 characters"),

  query("k")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("k must be an integer between 1 and 20")
    .toInt(),

  validationErrorHandler,
];
