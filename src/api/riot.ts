import apiClient from './apiClient';

export const getRiotServerStatus = async (region: string) => {
  const response = await apiClient.get(`/riot/status/${region}`);
  return response.data;
};

export const getSummonerByName = async (region: string, summonerName: string, summonerTag: string) => {
  const response = await apiClient.get(`/riot/summoner/${region}/${summonerName}/${summonerTag}`);
  
  // If the backend returns an empty body for a "not found" case, treat it as an error.
  if (!response.data) {
    throw new Error('NOT_FOUND');
  }
  return response.data;
};

export const getLeaderboard = async (region: string) => {
  const response = await apiClient.get(`/riot/leaderboards/challenger/${region}`);
  return response.data;
};