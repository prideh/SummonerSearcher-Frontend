export const camelCaseToTitleCase = (text: string) => {
  const result = text.replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
};

export const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};

export const isTimeChallenge = (key: string) => {
  const lowerKey = key.toLowerCase();
  return (
    (lowerKey.startsWith('earliest') ||
    lowerKey.startsWith('fastest') ||
    lowerKey.startsWith('shortest') ||
    (lowerKey.includes('time') && !lowerKey.includes('times') && !lowerKey.includes('perminute') && !lowerKey.includes('intime'))) &&
    lowerKey !== 'controlwardtimecoverageinriverorenemyhalf'
  );
};

export const formatPercentage = (value: number) => {
  return `${(value * 100).toFixed(1)}%`;
};

export const isPercentageChallenge = (key: string) => {
  const lowerKey = key.toLowerCase();
  return (
    lowerKey.includes('percent') ||
    lowerKey.includes('pct') ||
    lowerKey.includes('participation') ||
    lowerKey === 'controlwardtimecoverageinriverorenemyhalf' ||
    lowerKey === 'visionscoreadvantagelaneopponent'
  );
};

export const formatNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2);
};
