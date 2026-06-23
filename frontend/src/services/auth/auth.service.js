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
      return new Error('Request timed out. Please try again.');
    }
    return new Error(
      'Unable to connect to server. Please check your internet connection.',
    );
  }

  const status = error.response.status;
  const backendMessage =
    error.response.data?.msg || error.response.data?.message;

  switch (status) {
    case 400:
      return new Error(backendMessage || 'Invalid input data.');
    case 401:
      return new Error(backendMessage || 'Invalid email or password.');
    case 404:
      return new Error(backendMessage || 'Requested account data was not found.');
    case 503:
      return new Error(backendMessage || 'Service is temporarily unavailable.');
    case 500:
      return new Error(
        'Something went wrong on our end. Please try again later.',
      );
    default:
      return new Error(backendMessage || 'An unexpected error occurred.');
  }
}

export const authService = {
  register,
  login,
  confirmEmail,
  forgotPassword,
  resetPassword,
  logout,
  getStoredToken,
  getStoredUser,
  isAuthenticated,
};
