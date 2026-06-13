import { param,query } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";


/**
 * Validation rules for GET /api/questions/:questionHash/similar
 *
 * - questionHash: must be a 16-character hexadecimal string
 */
export const getSimilarQuestionsValidation = [
  param("questionHash")
    .matches(/^[a-fA-F0-9]{16}$/)
    .withMessage("Invalid question hash format"),
  param("questionHash")
    .matches(/^[a-fA-F0-9]{16}$/)
    .withMessage("Invalid question hash format"),

  query("k")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("k must be between 1 and 20"),

  query("threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("threshold must be between 0 and 1"),

  validationErrorHandler,
];
