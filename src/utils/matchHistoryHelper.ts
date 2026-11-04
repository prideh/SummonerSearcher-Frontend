/**
 * Converts a queue ID from the Riot API into a human-readable game mode name.
 * @param id - The numeric queue ID.
 * @returns The name of the game mode as a string.
 */
export const getQueueType = (id: number | undefined) => {
  switch (id) {
    case 420: return 'Ranked Solo';
    case 440: return 'Ranked Flex';
    case 450: return 'ARAM';
    case 400: return 'Normal Draft';
    case 430: return 'Normal Blind';
    default: return 'Other';
  }
};

/**
 * Formats a duration given in seconds into a "minutes:seconds" string format.
 * @param seconds - The duration in seconds.
 * @returns A formatted string, e.g., "25:31".
 */
export const formatDuration = (seconds: number | undefined) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Determines the appropriate styling and labels for a match based on its outcome.
 * @param win - A boolean indicating if the player won.
 * @param gameEndedInEarlySurrender - A boolean indicating if the game was a remake.
 * @returns An object containing CSS class names and a label for the outcome.
 */
export const getMatchOutcomeStyles = (win: boolean | undefined, gameEndedInEarlySurrender: boolean | undefined) => {
  if (gameEndedInEarlySurrender) {
    return {
      container: 'bg-slate-100/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 border-l-4 border-l-slate-400 dark:border-l-slate-500',
      text: 'text-slate-600 dark:text-slate-400',
      label: 'Remake',
    };
  }
  return win
    ? {
        container: 'bg-emerald-50/75 dark:bg-emerald-950/20 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500',
        text: 'text-emerald-700 dark:text-emerald-400',
        label: 'Victory',
      }
    : {
        container: 'bg-rose-50/75 dark:bg-rose-950/20 border border-slate-200 dark:border-slate-800 border-l-4 border-l-rose-500',
        text: 'text-rose-700 dark:text-rose-400',
        label: 'Defeat',
      };
};
