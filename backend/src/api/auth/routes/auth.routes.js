import express from 'express';
import {
  registerController,
  loginController,
  confirmEmailController,
  forgotPasswordController,
  resetPasswordController,
} from '../controller/auth.controller.js';
import {
  registerValidation,
  loginValidation,
  confirmEmailValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from '../validations/auth.validation.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', registerValidation, registerController);

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get token
 * @access Public
 */
router.post('/login', loginValidation, loginController);

/**
 * @route POST /api/auth/confirm-email
 * @desc Confirm user email from token
 * @access Public
 */
router.post('/confirm-email', confirmEmailValidation, confirmEmailController);

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset token
 * @access Public
 */
router.post(
  '/forgot-password',
  forgotPasswordValidation,
  forgotPasswordController,
);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using token
 * @access Public
 */
router.post('/reset-password', resetPasswordValidation, resetPasswordController);

export default router;
