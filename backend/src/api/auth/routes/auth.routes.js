import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  registerController,
  loginController,
  confirmEmailController,
  confirmEmailViaLinkController,
  verifyEmailOtpController,
  resendConfirmationController,
  forgotPasswordController,
  verifyResetOtpController,
  resetPasswordController,
} from '../controller/auth.controller.js';
import {
  registerValidation,
  loginValidation,
  confirmEmailValidation,
  verifyEmailOtpValidation,
  resendConfirmationValidation,
  forgotPasswordValidation,
  verifyResetOtpValidation,
  resetPasswordValidation,
} from '../validations/auth.validation.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Auth-specific rate limiters — tighter than the global /api limiter.
//
// login: 10 attempts / 15 min per IP — slows brute-force without locking out
//   legitimate users who mistype a few times.
// register / forgot-password: 5 / 60 min — both trigger email delivery so
//   abuse here means spam; stricter window is intentional.
// confirm-email / reset-password: 10 / 15 min — token is already one-time
//   use but limit prevents token-scanning bots.
// ---------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { msg: 'Too many login attempts. Please try again in 15 minutes.' },
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { msg: 'Too many accounts created from this IP. Please try again in 1 hour.' },
});

const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { msg: 'Too many password reset requests. Please try again in 1 hour.' },
});

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { msg: 'Too many requests. Please try again in 15 minutes.' },
});

// @route POST /api/auth/register
router.post('/register', registrationLimiter, registerValidation, registerController);

// @route POST /api/auth/login
router.post('/login', loginLimiter, loginValidation, loginController);

// @route POST /api/auth/confirm-email
router.post('/confirm-email', tokenLimiter, confirmEmailValidation, confirmEmailController);

// @route GET /api/auth/confirm-email?token=TOKEN  (email link click)
router.get('/confirm-email', confirmEmailViaLinkController);

// @route POST /api/auth/verify-email-otp  (confirm via 6-digit code)
router.post('/verify-email-otp', tokenLimiter, verifyEmailOtpValidation, verifyEmailOtpController);

// @route POST /api/auth/resend-confirmation  (re-issue confirmation OTP + link)
router.post('/resend-confirmation', passwordLimiter, resendConfirmationValidation, resendConfirmationController);

// @route POST /api/auth/forgot-password
router.post('/forgot-password', passwordLimiter, forgotPasswordValidation, forgotPasswordController);

// @route POST /api/auth/verify-reset-otp  (verify reset code → short-lived reset token)
router.post('/verify-reset-otp', tokenLimiter, verifyResetOtpValidation, verifyResetOtpController);

// @route POST /api/auth/reset-password
router.post('/reset-password', tokenLimiter, resetPasswordValidation, resetPasswordController);

export default router;
