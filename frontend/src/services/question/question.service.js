import { apiClient } from '../core/api.client.js';

/**
 * Centralized error handler for question service requests.
 */
function handleQuestionError(error) {
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

  const errorCode = error.response.data?.error?.code;
  const guidance  = error.response.data?.error?.guidance;

  const existingHash    = error.response.data?.error?.existingQuestionHash;
  const existingTitle   = error.response.data?.error?.existingQuestionTitle;
  const similarHash     = error.response.data?.error?.similarQuestionHash;
  const similarTitle    = error.response.data?.error?.similarQuestionTitle;
  const url = error.config?.url || 'this request';

  const make = (msg) => {
    const e = new Error(msg);
    if (errorCode)    e.code = errorCode;
    if (guidance)     e.guidance = guidance;
    if (existingHash)  e.existingQuestionHash  = existingHash;
    if (existingTitle) e.existingQuestionTitle = existingTitle;
    if (similarHash)   e.similarQuestionHash   = similarHash;
    if (similarTitle)  e.similarQuestionTitle  = similarTitle;
    return e;
  };

  switch (status) {
    case 400:
      return make(backendMessage || 'Invalid input data.');
    case 401:
      return make(backendMessage || 'Unauthorized. Please log in again.');
    case 403:
      return make(backendMessage || 'You do not have permission to perform this action.');
    case 404:
      return make(
        backendMessage ||
          'The requested resource was not found. It may have been removed or the link is invalid.',
      );
    case 409:
      return make(
        backendMessage ||
          'This action conflicts with the current data state. Refresh and try again.',
      );
    case 422:
      return make(
        backendMessage ||
          'Your submission could not be processed due to validation rules. Please review the input and try again.',
      );
    case 429:
      return make(
        backendMessage ||
          'Too many requests in a short time. Please wait a moment and try again.',
      );
    case 500:
      return make(
        backendMessage ||
          `The server failed while processing ${url}. Please try again shortly.`,
      );
    case 502:
    case 503:
    case 504:
      return make(
        backendMessage ||
          'The service is temporarily unavailable. Please try again in a moment.',
      );
    default:
      return make(
        backendMessage ||
          `Request failed with status ${status}. Please try again.`,
      );
  }
}

/**
 * Creates a new question in the forum.
 * @param {{ title: string, content: string }} questionData
 */
async function createQuestion(questionData, { force = false } = {}) {
  try {
    const response = await apiClient.post('/api/questions', { ...questionData, force });
    return response.data;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Fetches questions list with optional filters.
 * @param {{ search?: string, mine?: boolean }} filters
 */
async function getQuestions(filters = {}) {
  try {
    const response = await apiClient.get('/api/questions', {
      params: filters,
    });

    return response.data?.questions || response.data?.data || [];
  } catch (error) {
    throw handleQuestionError(error);
  }
}


/**
 * Fetches a single question and its answers by hash.
 * @param {string} questionHash
 */
async function getSingleQuestion(questionHash) {
  try {
    const response = await apiClient.get(`/api/questions/${questionHash}`);
    return response.data?.question || response.data?.data || null;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Posts an answer to an existing question.
 * @param {number} questionId
 * @param {string} content
 */
async function postAnswer(questionId, content) {
  try {
    const response = await apiClient.post('/api/answers', { questionId, content });
    const full = response.data;
    const answer = full.data || {};
    // The backend sets flagged/moderation on the answer object (full.data), not at
    // the top level. Read from the answer first (falling back to any top-level
    // fields) so flagged answers correctly surface the "under review" state.
    return {
      ...answer,
      flagged: answer.flagged ?? full.flagged ?? false,
      moderation: answer.moderation ?? full.moderation ?? null,
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Calls the AI answer fit endpoint for a question hash.
 * @param {string} questionHash
 * @param {string} draftAnswer
 */
async function assessAnswerFit(questionHash, draftAnswer) {
  try {
    const response = await apiClient.post(
      `/api/questions/${questionHash}/answer-fit`,
      { draftAnswer },
    );

    return response.data?.data || response.data;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Calls the AI Draft Coach endpoint to get feedback on a question draft.
 * @param {{ title: string, content: string }} draftData
 */
async function generateAIContext({ title, content }) {
  try {
    const response = await apiClient.post('/api/questions/ai-search', { title, content });
    return response.data?.answer || null;
  } catch (error) {
    throw handleQuestionError(error);
  }
}

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
 * Performs AI semantic search on questions using vector similarity.
 * Returns { data: Question[], aiAnswer: string | null, meta: object | null }
 * @param {string} query
 * @param {{ k?: number, threshold?: number }} options
 */
async function searchQuestionsSemantic(query, { k = 5, threshold = 0.75 } = {}) {
  try {
    const response = await apiClient.get('/api/questions/search', {
      params: { query, k, threshold },
    });
    return {
      data: response.data?.data || [],
      aiAnswer: response.data?.aiAnswer || null,
      meta: response.data?.meta || null,
    };
  } catch (error) {
    throw handleQuestionError(error);
  }
}

/**
 * Fetches questions similar to a given question using stored vector similarity.
 * @param {string} questionHash
 * @param {{ k?: number, threshold?: number }} options
 */
async function getSimilarQuestions(questionHash, { k = 5, threshold = 0.75 } = {}) {
  try {
    const response = await apiClient.get(`/api/questions/${questionHash}/similar`, {
      params: { k, threshold },
    });
    return response.data?.data || [];
  } catch {
    return []; // non-fatal: sidebar just stays empty
  }
}

export {
  getQuestions,
  searchQuestionsSemantic,
  getSimilarQuestions,
  getSingleQuestion,
  createQuestion,
  postAnswer,
  assessAnswerFit,
  generateQuestionDraftCoach,
  generateAIContext,
};

/**
 * Service for handling question-related API requests.
 */
export const questionService = {
  getQuestions,
  searchQuestionsSemantic,
  getSimilarQuestions,
  getSingleQuestion,
  createQuestion,
  postAnswer,
  assessAnswerFit,
  generateQuestionDraftCoach,
  generateAIContext,
};
