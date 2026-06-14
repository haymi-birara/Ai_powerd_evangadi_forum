import { body } from "express-validator";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";

const answerFitValidation = [
  body("draftAnswer")
    .notEmpty()
    .withMessage("Draft answer is required")
    .isString()
    .withMessage("Draft answer must be a string")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Draft answer must be at least 10 characters"),
  validationErrorHandler,
];

export default answerFitValidation;
