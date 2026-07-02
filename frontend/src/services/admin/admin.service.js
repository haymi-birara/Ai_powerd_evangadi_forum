import { apiClient } from '../core/api.client.js';

function handleAdminError(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') return new Error('Request timed out. Please try again.');
    return new Error('Unable to connect to server. Please check your internet connection.');
  }

  const status = error.response.status;
  const backendMessage =
    error.response.data?.error?.message ||
    error.response.data?.msg ||
    error.response.data?.message;

  switch (status) {
    case 403: return new Error(backendMessage || 'Admin access required.');
    case 404: return new Error(backendMessage || 'Post not found in queue.');
    case 409: return new Error(backendMessage || 'This post has already been actioned.');
    case 500: return new Error(`Server error processing this request. Please try again.`);
    default:  return new Error(backendMessage || 'An unexpected error occurred.');
  }
}

async function getMetrics() {
  try {
    const response = await apiClient.get('/api/admin/metrics');
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

async function getQueue({ page = 1, limit = 20 } = {}) {
  try {
    const response = await apiClient.get('/api/admin/queue', { params: { page, limit } });
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

async function approvePost(postId) {
  try {
    const response = await apiClient.post(`/api/admin/queue/${postId}/approve`);
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

async function removePost(postId) {
  try {
    const response = await apiClient.post(`/api/admin/queue/${postId}/remove`);
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

async function escalatePost(postId) {
  try {
    const response = await apiClient.post(`/api/admin/queue/${postId}/escalate`);
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

async function getUsers({ page = 1, limit = 20, status = 'all' } = {}) {
  try {
    const response = await apiClient.get('/api/admin/users', { params: { page, limit, status } });
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

async function updateUserRole(userId, role) {
  try {
    const response = await apiClient.patch(`/api/admin/users/${userId}/role`, { role });
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

async function getFlagHistory({ page = 1, limit = 20, status = 'all' } = {}) {
  try {
    const response = await apiClient.get('/api/admin/flags', { params: { page, limit, status } });
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

async function deleteUser(userId) {
  try {
    const response = await apiClient.delete(`/api/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

async function resendUserConfirmation(userId) {
  try {
    const response = await apiClient.post(`/api/admin/users/${userId}/resend-confirmation`);
    return response.data;
  } catch (error) {
    throw handleAdminError(error);
  }
}

export const adminService = {
  getMetrics,
  getQueue,
  approvePost,
  removePost,
  escalatePost,
  getUsers,
  updateUserRole,
  deleteUser,
  getFlagHistory,
  resendUserConfirmation,
};
