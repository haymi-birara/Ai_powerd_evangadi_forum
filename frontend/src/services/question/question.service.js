import { apiClient } from '../core/api.client.js';

/**
 * Centralized error handler for question service requests.
 */
function handleQuestionError(error) {
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
      return new Error(backendMessage || 'Unauthorized. Please log in again.');
    case 500:
      return new Error(
        'Something went wrong on our end. Please try again later.',
      );
    default:
      return new Error(backendMessage || 'An unexpected error occurred.');
  }
}

/**
 * Creates a new question in the forum.
 * @param {{ title: string, content: string }} questionData
 */
async function createQuestion(questionData) {
  try {
    const response = await apiClient.post('/api/questions', questionData);
    return response.data;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Calls the AI Draft Coach endpoint to get feedback on a question draft.
 * @param {{ title: string, content: string }} draftData
 */
async function generateQuestionDraftCoach(draftData) {
  try {
    const response = await apiClient.post(
      '/api/questions/draft-coach',
      draftData,
    );
    return response.data;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Service for handling question-related API requests.
 */
export const questionService = {
  createQuestion,
  generateQuestionDraftCoach,
};
