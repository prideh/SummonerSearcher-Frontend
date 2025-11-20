import React, { useEffect } from 'react';
import { useDataDragonStore } from '../store/dataDragonStore';

interface RuneIconProps {
  runeId: number | undefined;
  isKeystone?: boolean;
  className?: string;
}

const RuneIcon: React.FC<RuneIconProps> = ({ runeId, className = 'w-6 h-6' }) => {
  const { runeMap, fetchRuneData } = useDataDragonStore();
  const cdnImgUrl = useDataDragonStore(state => state.cdnImgUrl);

  useEffect(() => {
    if (!runeMap) {
      fetchRuneData();
    }
  }, [runeMap, fetchRuneData]);

  if (!runeId) {
    return <div className={`${className} bg-gray-200 dark:bg-gray-800/50 rounded-full`}></div>;
  }

  const rune = runeMap?.[runeId];

  const tooltipContent = rune ? `
    <div class="text-left max-w-xs">
      <div class="font-bold text-yellow-400">${rune.name}</div>
      <div class="text-sm text-gray-200 dark:text-gray-300 mt-2">${rune.shortDesc}</div>
    </div>
  ` : 'Loading rune data...';

  return (
    <img
      src={`${cdnImgUrl}${rune?.icon}`}
      alt={rune?.name || `Rune ${runeId}`}
      className={className}
      data-tooltip-id="item-tooltip"
      data-tooltip-html={tooltipContent}
    />
  );
};

export default RuneIcon;