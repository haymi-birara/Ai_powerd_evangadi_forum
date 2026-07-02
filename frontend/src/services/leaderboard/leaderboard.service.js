import { apiClient } from '../core/api.client.js';

function handleLeaderboardError(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') return new Error('Request timed out. Please try again.');
    return new Error('Unable to connect to server. Please check your internet connection.');
  }

  const backendMessage =
    error.response.data?.error?.message ||
    error.response.data?.msg ||
    error.response.data?.message;

  return new Error(backendMessage || 'Failed to load leaderboard.');
}

async function getMonthlyLeaderboard() {
  try {
    const response = await apiClient.get('/api/leaderboard/monthly');
    // Backend shape: { success, period, data[] }. Return the { period, data }
    // object the page expects (returning response.data.data would drop period).
    return { period: response.data?.period ?? null, data: response.data?.data ?? [] };
  } catch (error) {
    throw handleLeaderboardError(error);
  }
}

async function getAllTimeLeaderboard() {
  try {
    const response = await apiClient.get('/api/leaderboard/alltime');
    // Backend shape: { success, data[] }. Return { data } so callers can read .data.
    return { data: response.data?.data ?? [] };
  } catch (error) {
    throw handleLeaderboardError(error);
  }
}

async function getLastMonthLeaderboard() {
  try {
    const response = await apiClient.get('/api/leaderboard/last-month');
    // Backend shape: { success, period, data[] }.
    return { period: response.data?.period ?? null, data: response.data?.data ?? [] };
  } catch (error) {
    throw handleLeaderboardError(error);
  }
}

export const leaderboardService = { getMonthlyLeaderboard, getLastMonthLeaderboard, getAllTimeLeaderboard };
