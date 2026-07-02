import { apiClient } from '../core/api.client.js';

/**
 * Centralized error handler for answer-notification requests.
 * Mirrors the convention in services/releases/releases.service.js.
 */
function handleNotificationError(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') return new Error('Request timed out. Please try again.');
    return new Error('Unable to connect to server. Please check your internet connection.');
  }
  const backendMessage =
    error.response.data?.error?.message ||
    error.response.data?.msg ||
    error.response.data?.message;
  return new Error(backendMessage || 'Unable to load notifications.');
}

/** New answers on the current user's questions. Returns { data, count }. */
async function getUnseenAnswers() {
  try {
    const response = await apiClient.get('/api/notifications/answers/unseen');
    return { data: response.data?.data || [], count: response.data?.count || 0 };
  } catch (error) {
    throw handleNotificationError(error);
  }
}

/** Marks all current answer notifications as seen for the current user. */
async function markAnswersSeen() {
  try {
    const response = await apiClient.post('/api/notifications/answers/seen');
    return response.data;
  } catch (error) {
    throw handleNotificationError(error);
  }
}

/** Recent answers on the current user's questions (ignores seen state). */
async function getRecentAnswers() {
  try {
    const response = await apiClient.get('/api/notifications/answers');
    return response.data?.data || [];
  } catch (error) {
    throw handleNotificationError(error);
  }
}

/** New upvotes on the current user's answers. Returns { data, count }. */
async function getUnseenVotes() {
  try {
    const response = await apiClient.get('/api/notifications/votes/unseen');
    return { data: response.data?.data || [], count: response.data?.count || 0 };
  } catch (error) {
    throw handleNotificationError(error);
  }
}

/** Marks all current upvote notifications as seen for the current user. */
async function markVotesSeen() {
  try {
    const response = await apiClient.post('/api/notifications/votes/seen');
    return response.data;
  } catch (error) {
    throw handleNotificationError(error);
  }
}

/** Recent upvotes on the current user's answers (ignores seen state). */
async function getRecentVotes() {
  try {
    const response = await apiClient.get('/api/notifications/votes');
    return response.data?.data || [];
  } catch (error) {
    throw handleNotificationError(error);
  }
}

/** Combined unseen counts (answers + upvotes) in a single request. */
async function getUnseenCounts() {
  try {
    const response = await apiClient.get('/api/notifications/unseen');
    return {
      answerCount: response.data?.answerCount || 0,
      voteCount: response.data?.voteCount || 0,
      totalCount: response.data?.totalCount || 0,
    };
  } catch (error) {
    throw handleNotificationError(error);
  }
}

/** Current user's own moderation history + standing (incident count, status). */
async function getModerationNotices() {
  try {
    const response = await apiClient.get('/api/notifications/moderation');
    return {
      data:     response.data?.data     || [],
      standing: response.data?.standing || { status: 'active', incidentCount: 0, blockedUntil: null },
    };
  } catch (error) {
    throw handleNotificationError(error);
  }
}

export const notificationsService = {
  getUnseenAnswers,
  markAnswersSeen,
  getRecentAnswers,
  getUnseenVotes,
  markVotesSeen,
  getRecentVotes,
  getUnseenCounts,
  getModerationNotices,
};
