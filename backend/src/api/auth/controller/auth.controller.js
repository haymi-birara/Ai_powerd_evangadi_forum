import { StatusCodes } from 'http-status-codes'; // Importing HTTP status codes for standardized response statuses.
// Importing service functions that contain the business logic for authentication operations.
import {
  registerService, // Service function to handle user registration logic.
  loginService, // Service function to handle user login logic and token generation.
  confirmEmailService, // Service function to handle email confirmation logic using a token.
  verifyEmailOtpService, // Service function to confirm email using a 6-digit OTP.
  resendConfirmationOtpService, // Service function to re-issue a confirmation OTP.
  forgotPasswordService, // Service function to handle forgot password logic and token generation.
  verifyResetOtpService, // Service function to verify a reset OTP and issue a reset token.
  resetPasswordService, // Service function to handle password reset logic using a token.
} from '../service/auth.service.js';

/**
 * Handles user registration requests.
 */
export const registerController = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const registerResult = await registerService({
      firstName,
      lastName,
      email,
      password,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: registerResult.confirmationMessage,
      welcomeMessage: registerResult.welcomeMessage,
      user: registerResult.user,
      confirmationUrl: registerResult.confirmationUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles user login requests.
 */
export const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const authResult = await loginService({ email, password });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Login successful.',
      user: authResult.user,
      token: authResult.token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles email confirmation requests.
 */
export const confirmEmailController = async (req, res, next) => {
  try {
    const { token } = req.body; // The token is expected to be sent in the request body for email confirmation.
    const result = await confirmEmailService({ token }); // Call the service function to confirm the email using the provided token.
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Email confirmed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles email confirmation via link (GET) — confirms server-side and redirects to frontend.
 */
export const confirmEmailViaLinkController = async (req, res) => {
  const { token } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5001';

  if (!token) {
    return res.redirect(`${frontendUrl}/#/auth?confirmed=error&message=${encodeURIComponent('No confirmation token provided')}`);
  }

  try {
    await confirmEmailService({ token });
    return res.redirect(`${frontendUrl}/#/auth?confirmed=success`);
  } catch (err) {
    return res.redirect(`${frontendUrl}/#/auth?confirmed=error&message=${encodeURIComponent(err.message || 'Confirmation failed')}`);
  }
};

/**
 * Handles email confirmation via a 6-digit OTP.
 */
export const verifyEmailOtpController = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyEmailOtpService({ email, otp });
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Email confirmed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Re-sends a confirmation OTP (and link) for an unverified account.
 */
export const resendConfirmationController = async (req, res, next) => {
  try {
    const { email } = req.body;
    await resendConfirmationOtpService({ email });
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'If an unverified account exists for this email, a new code has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/** * Handles forgot password requests.
 */
export const forgotPasswordController = async (req, res, next) => {
  try {
    const { email } = req.body;
    await forgotPasswordService({ email });

    res.status(StatusCodes.OK).json({
      success: true,
      message:
        'If an account exists for this email, password recovery instructions were sent.',
    });
  } catch (error) {
    next(error);
  }
};
/** * Handles fetching questions list with optional filters.
 */
export const resetPasswordController = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const result = await resetPasswordService({ token, newPassword });

    res.status(StatusCodes.OK).json({
      success: true,
      message:
        'Password reset successful. You can now sign in with your new password.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verifies a password-reset OTP and returns a short-lived reset token.
 */
export const verifyResetOtpController = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyResetOtpService({ email, otp });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Code verified. You can now set a new password.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
