import { body, param, query } from 'express-validator';
import {validationErrorHandler} from '../../../middleware/validation-handler.js'

export const queryAssistantValidation = [
  query('question')
    .trim() 
    .notEmpty()
    .withMessage('Query parameter "question" is required.'),
  validationErrorHandler, 
];

export const queryDocumentValidation = [
  param('documentId')
    .notEmpty()
    .withMessage('Document ID is required')
    .bail()
    .isInt({ min: 1 })
    .withMessage('Document ID must be a positive integer')
    .toInt(),

  body('query')
    .notEmpty()
    .withMessage('Query is required')
    .bail()
    .isString()
    .withMessage('Query must be a string')
    .bail()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Query cannot be empty'),

  validationErrorHandler,
];
