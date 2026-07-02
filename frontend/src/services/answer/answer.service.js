import { apiClient } from '../core/api.client.js';

function handleAnswerError(error) {
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
    case 400: return new Error(backendMessage || 'Invalid request.');
    case 401: return new Error(backendMessage || 'Please log in again.');
    case 403: return new Error(backendMessage || 'Action not allowed.');
    case 409: return new Error(backendMessage || 'Conflict with existing data.');
    case 404: return new Error(backendMessage || 'Not found.');
    case 500: return new Error('Something went wrong on our end. Please try again later.');
    default:  return new Error(backendMessage || 'An unexpected error occurred.');
  }
}

async function addVote(answerId) {
  try {
    const response = await apiClient.post(`/api/answers/${answerId}/vote`);
    return response.data?.data || response.data;
  } catch (error) {
    throw handleAnswerError(error);
  }
}

async function removeVote(answerId) {
  try {
    const response = await apiClient.delete(`/api/answers/${answerId}/vote`);
    return response.data?.data || response.data;
  } catch (error) {
    throw handleAnswerError(error);
  }
}

/** Post a question-owner reply to an answer. Returns the created reply. */
async function postReply(answerId, content) {
  try {
    const response = await apiClient.post(`/api/answers/${answerId}/reply`, { content });
    return response.data?.data || response.data;
  } catch (error) {
    throw handleAnswerError(error);
  }
}

export const answerService = { addVote, removeVote, postReply };
