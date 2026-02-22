/**
 * Returns the Tailwind text color classes based on the given KDA.
 * 
 * Rules:
 * >= 7.00: Golden/Orange
 * >= 5.00: Blue
 * >= 3.00: Green
 * < 3.00: Default (gray)
 */
export const getKdaColorClass = (kda: number): string => {
  if (kda >= 7) return 'text-yellow-500 dark:text-yellow-400';
  if (kda >= 5) return 'text-blue-600 dark:text-blue-400';
  if (kda >= 3) return 'text-green-600 dark:text-green-400';
  return 'text-gray-900 dark:text-gray-100';
};

/**
 * Returns the Tailwind text color classes based on the given win rate percentage.
 * 
 * Rules:
 * >= 60%: Blue
 * >= 50%: Green
 * < 50%: Red
 */
export const getWinRateColorClass = (winRate: number): string => {
  if (winRate >= 60) return 'text-blue-600 dark:text-blue-400';
  if (winRate >= 50) return 'text-green-600 dark:text-green-400';
  return 'text-red-500 dark:text-red-400';
};
