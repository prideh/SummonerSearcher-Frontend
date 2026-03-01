import apiClient from './apiClient';

export interface AutocompletePlayerDto {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  profileIconId: number;
  summonerLevel: number;
}

/**
 * Fetches autocomplete suggestions for a given region and query prefix.
 * @param region The server region (e.g., 'na1', 'euw1').
 * @param query The partial or full game name.
 * @returns A promise resolving to a list of matching players.
 */
export const fetchAutocompleteSuggestions = async (
  query: string
): Promise<AutocompletePlayerDto[]> => {
  if (query.length < 2) return [];
  
  try {
    const response = await apiClient.get<AutocompletePlayerDto[]>(`/search/autocomplete`, {
      params: { query }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch autocomplete suggestions:', error);
    return [];
  }
};
