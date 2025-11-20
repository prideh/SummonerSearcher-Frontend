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

export const formatDuration = (seconds: number | undefined) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getMatchOutcomeStyles = (win: boolean | undefined, gameEndedInEarlySurrender: boolean | undefined) => {
  if (gameEndedInEarlySurrender) {
    return {
      container: 'bg-gray-700/20 border-gray-500',
      text: 'text-gray-400',
      label: 'Remake',
    };
  }
  return win
    ? { container: 'bg-blue-900/30 border-blue-500', text: 'text-blue-400', label: 'Victory' }
    : { container: 'bg-red-900/30 border-red-700', text: 'text-red-300', label: 'Defeat' };
};
