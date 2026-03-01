import React from 'react';
import { useDataDragonStore } from '../store/dataDragonStore';

interface SummonerSpellIconProps {
  spellId: number | undefined;
  className?: string;
}

const SummonerSpellIcon: React.FC<SummonerSpellIconProps> = ({ spellId, className = 'w-8 h-8' }) => {
  const summonerSpellMap = useDataDragonStore(state => state.summonerSpellMap);
  const cdnUrl = useDataDragonStore(state => state.cdnUrl);

  if (!spellId || !cdnUrl) {
    return <div className={`${className} bg-gray-200 dark:bg-gray-800/50 rounded`}></div>;
  }

  const spell = summonerSpellMap?.[spellId];

  const tooltipContent = spell ? `
    <div class="text-left max-w-xs">
      <div class="font-bold text-cyan-500 dark:text-cyan-400">${spell.name}</div>
      <div class="text-sm text-gray-200 dark:text-gray-300 my-2">${spell.description}</div>
    </div>
  ` : 'Loading spell data...';

  return (
    <img
      src={`${cdnUrl}/img/spell/${spell?.image.full}`}
      loading="lazy"
      alt={spell?.name || `Spell ${spellId}`}
      className={`${className} rounded`}
      data-tooltip-id="item-tooltip" // We can reuse the item tooltip style
      data-tooltip-content={tooltipContent}
    />
  );
};

export default SummonerSpellIcon;
