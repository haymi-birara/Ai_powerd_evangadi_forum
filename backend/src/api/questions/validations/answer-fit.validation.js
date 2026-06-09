import { body } from 'express-validator';

const answerFitValidation = [
  body('draftAnswer')
    .trim()
    .notEmpty()
    .withMessage('Draft answer is required')
    .isLength({ min: 10 })
    .withMessage('Draft answer must be at least 10 characters'),
];

export default answerFitValidation;