const specialCases: Record<string, string> = {
  'FiddleSticks': 'Fiddlesticks',
  // Add other special cases here if you find them
  // e.g., 'Wukong': 'MonkeyKing' if the API returns 'Wukong' but the image is 'MonkeyKing.png'
};

export const getCorrectChampionName = (championName: string | undefined): string | undefined => {
  if (!championName) {
    return undefined;
  }
  return specialCases[championName] || championName;
};