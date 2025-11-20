import apiClient from './apiClient';

/**
 * Fetches the server status for a specific Riot Games region.
 * @param region - The region to check (e.g., 'EUW1', 'NA1').
 * @returns A promise that resolves with the server status data.
 */
export const getRiotServerStatus = async (region: string) => {
  const response = await apiClient.get(`/riot/status/${region}`);
  return response.data;
};

/**
 * Fetches summoner data, including profile, rank, and recent matches, by their Riot ID.
 * @param region - The summoner's region.
 * @param summonerName - The summoner's game name.
 * @param summonerTag - The summoner's tag line (without the '#').
 * @returns A promise that resolves with the summoner's data.
 * @throws An error with the message 'NOT_FOUND' if the summoner does not exist.
 */
export const getSummonerByName = async (region: string, summonerName: string, summonerTag: string) => {
  const response = await apiClient.get(`/riot/summoner/${region}/${summonerName}/${summonerTag}`);
  
  // If the backend returns an empty body for a "not found" case, treat it as an error.
  if (!response.data) {
    throw new Error('NOT_FOUND');
  }
  return response.data;
};

/**
 * Fetches the Challenger leaderboard for a given region.
 * @param region - The region for which to fetch the leaderboard.
 * @returns A promise that resolves with the leaderboard data.
 */
export const getLeaderboard = async (region: string) => {
  const response = await apiClient.get(`/riot/leaderboards/challenger/${region}`);
  return response.data;
};