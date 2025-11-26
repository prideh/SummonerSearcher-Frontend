/**
 * Maps API region codes to URL-friendly region codes.
 */
export const REGION_MAPPING: Record<string, string> = {
  'EUW1': 'eu',
  'NA1': 'na',
  'KR': 'kr',
};

/**
 * Maps URL-friendly region codes back to API region codes.
 */
export const REVERSE_REGION_MAPPING: Record<string, string> = Object.entries(REGION_MAPPING).reduce(
  (acc, [key, value]) => {
    acc[value] = key;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Converts an API region code (e.g., 'EUW1') to a URL region code (e.g., 'eu').
 * Defaults to the input if no mapping is found.
 */
export const toUrlRegion = (apiRegion: string): string => {
  return REGION_MAPPING[apiRegion] || apiRegion.toLowerCase();
};

/**
 * Converts a URL region code (e.g., 'eu') to an API region code (e.g., 'EUW1').
 * Defaults to 'EUW1' if no mapping is found or input is invalid.
 */
export const toApiRegion = (urlRegion: string | null): string => {
  if (!urlRegion) return 'EUW1';
  
  // Check if it's a direct match for a reverse mapping (e.g. 'eu' -> 'EUW1')
  const mapped = REVERSE_REGION_MAPPING[urlRegion.toLowerCase()];
  if (mapped) return mapped;

  // Check if the input itself is a valid API region (case-insensitive)
  // e.g. 'na1' -> 'NA1', 'euw1' -> 'EUW1'
  const upperInput = urlRegion.toUpperCase();
  if (REGION_MAPPING[upperInput]) {
    return upperInput;
  }

  return 'EUW1';
};
