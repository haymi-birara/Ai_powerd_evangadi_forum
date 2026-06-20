import express from 'express'; // Express router for authentication-related routes.
// Importing controller functions that handle the logic for each authentication route.
import {
  registerController, // Handles user registration logic.
  loginController,// Handles user login logic and token generation.
  confirmEmailController, // Handles email confirmation logic using a token.
  forgotPasswordController, // Handles forgot password logic and token generation.
  resetPasswordController, // Handles password reset logic using a token.
} from '../controller/auth.controller.js';
// Importing validation middleware for each authentication route to ensure incoming requests have the correct format and required fields.
import {
  registerValidation, // Validates registration request body (e.g., email, password).
  loginValidation, // Validates login request body (e.g., email, password).
  confirmEmailValidation, // Validates email confirmation request body (e.g., token).
  forgotPasswordValidation, // Validates forgot password request body (e.g., email).
  resetPasswordValidation, // Validates reset password request body (e.g., token, new password).
} from '../validations/auth.validation.js';

const router = express.Router(); // Create a new Express router instance to define authentication routes on.

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', registerValidation, registerController); // Define the registration route with validation and controller logic.

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get token
 * @access Public
 */
router.post('/login', loginValidation, loginController); // Define the login route with validation and controller logic.

/**
 * @route POST /api/auth/confirm-email
 * @desc Confirm user email from token
 * @access Public
 */
router.post('/confirm-email', confirmEmailValidation, confirmEmailController); // Define the email confirmation route with validation and controller logic.

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset token
 * @access Public
 */
router.post(
  '/forgot-password',
  forgotPasswordValidation, 
  forgotPasswordController,
); // Define the forgot password route with validation and controller logic.

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using token
 * @access Public
 */
router.post('/reset-password', resetPasswordValidation, resetPasswordController); // Define the reset password route with validation and controller logic.

export default router;
