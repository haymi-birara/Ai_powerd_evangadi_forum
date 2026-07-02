import { apiClient } from '../core/api.client.js';

/**
 * Registers a new user.
 */
async function register(userData) {
  try {
    const response = await apiClient.post('/api/auth/register', userData);
    return {
      user: response.data.user,
      welcomeMessage: response.data.welcomeMessage,
      confirmationMessage: response.data.message,
      confirmationUrl: response.data.confirmationUrl,
    };
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Confirms email using a confirmation token.
 */
async function confirmEmail(token) {
  try {
    const response = await apiClient.post('/api/auth/confirm-email', { token });
    return response.data?.data;
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Confirms email using a 6-digit OTP.
 */
async function verifyEmailOtp({ email, otp }) {
  try {
    const response = await apiClient.post('/api/auth/verify-email-otp', { email, otp });
    return response.data?.data;
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Re-sends the confirmation code (and link) for an unverified account.
 */
async function resendConfirmation(email) {
  try {
    const response = await apiClient.post('/api/auth/resend-confirmation', { email });
    return { message: response.data?.message };
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Requests password reset link by email.
 */
async function forgotPassword(email) {
  try {
    const response = await apiClient.post('/api/auth/forgot-password', { email });
    return {
      message: response.data?.message,
    };
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Verifies a password-reset OTP and returns a short-lived reset token.
 */
async function verifyResetOtp({ email, otp }) {
  try {
    const response = await apiClient.post('/api/auth/verify-reset-otp', { email, otp });
    return response.data?.data;
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Resets password using a reset token.
 */
async function resetPassword(payload) {
  try {
    const response = await apiClient.post('/api/auth/reset-password', payload);
    return response.data?.data;
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Logs in an existing user and stores their session in localStorage.
 */
async function login(credentials) {
  try {
    const response = await apiClient.post('/api/auth/login', credentials);
    const { user, token } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    return { user, token };
  } catch (error) {
    throw handleAuthError(error);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function getStoredToken() {
  return localStorage.getItem('token');
}

function getStoredUser() {
  const userJson = localStorage.getItem('user');
  if (!userJson) return null;

  try {
    return JSON.parse(userJson);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

function isAuthenticated() {
  return !!getStoredToken();
}

function handleAuthError(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return new Error('Request timed out. The server took too long to respond. Please try again.');
    }
    return new Error(
      'Cannot reach the server. This is usually a network issue or the API is down.',
    );
  }

  const status = error.response.status;
  const backendMessage =
    error.response.data?.error?.message ||
    error.response.data?.msg ||
    error.response.data?.message;
  const url = error.config?.url || 'this request';

  switch (status) {
    case 400:
      return new Error(backendMessage || 'Invalid input data.');
    case 401:
      return new Error(backendMessage || 'Invalid email or password.');
    case 403:
      return new Error(
        backendMessage ||
          'Your account is not allowed to perform this action.',
      );
    case 404:
      return new Error(backendMessage || 'Requested account data was not found.');
    case 409:
      return new Error(
        backendMessage ||
          'This request conflicts with existing account data. Please review and try again.',
      );
    case 422:
      return new Error(
        backendMessage ||
          'Some fields did not pass validation. Please review your input.',
      );
    case 429:
      return new Error(
        backendMessage ||
          'Too many attempts. Please wait a bit before trying again.',
      );
    case 503:
      return new Error(backendMessage || 'Service is temporarily unavailable.');
    case 500:
      return new Error(
        backendMessage ||
          `The server failed while processing ${url}. Please try again shortly.`,
      );
    case 502:
    case 504:
      return new Error(
        backendMessage ||
          'Authentication service is temporarily unavailable. Please try again in a moment.',
      );
    default:
      return new Error(
        backendMessage ||
          `Request failed with status ${status}. Please try again.`,
      );
  }
}

export const authService = {
  register,
  login,
  confirmEmail,
  verifyEmailOtp,
  resendConfirmation,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  logout,
  getStoredToken,
  getStoredUser,
  isAuthenticated,
};
