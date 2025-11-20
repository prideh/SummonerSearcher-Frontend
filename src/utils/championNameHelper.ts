/**
 * A map to handle special cases where the champion name from the API
 * does not match the champion name used for image assets in Data Dragon.
 * For example, the API returns 'FiddleSticks' but the image is 'Fiddlesticks.png'.
 */
const specialCases: Record<string, string> = {
  'FiddleSticks': 'Fiddlesticks',
};

/**
 * Corrects a champion name from the API to match the name required for Data Dragon image assets.
 * @param championName - The champion name as returned by the Riot API.
 * @returns The corrected champion name, or undefined if the input was undefined.
 */
export const getCorrectChampionName = (championName: string | undefined): string | undefined => {
  if (!championName) {
    return undefined;
  }
  return specialCases[championName] || championName;
};