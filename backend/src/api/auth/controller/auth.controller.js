import { StatusCodes } from 'http-status-codes';
import {
  registerService,
  loginService,
  confirmEmailService,
  forgotPasswordService,
  resetPasswordService,
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

export const confirmEmailController = async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await confirmEmailService({ token });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Email confirmed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

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
