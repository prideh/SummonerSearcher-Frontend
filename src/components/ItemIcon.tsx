import React from 'react';
import { useDataDragonStore } from '../store/dataDragonStore';

interface ItemIconProps {
  itemId: number | undefined;
  className?: string;
}

const ItemIcon: React.FC<ItemIconProps> = ({ itemId, className = 'w-8 h-8' }) => {
  const itemMap = useDataDragonStore(state => state.itemMap);
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

  if (!itemId || !CDN_URL) {
    return <div className={`${className} bg-slate-200/75 dark:bg-slate-900/75 border border-slate-300/70 dark:border-slate-800 rounded`}></div>;
  }

  const item = itemMap?.[itemId];

  const tooltipContent = item ? `
    <div class="text-left max-w-xs">
      <div class="font-bold text-cyan-500 dark:text-cyan-400">${item.name}</div>
      <div class="text-sm text-gray-200 dark:text-gray-300 my-2">${item.description}</div>
      <div class="text-sm text-yellow-400">Cost: ${item.gold.total}</div>
    </div>
  ` : 'Loading item data...';

  return (
    <img
      src={`${CDN_URL}/img/item/${itemId}.png`}
      loading="lazy"
      alt={item?.name || `Item ${itemId}`}
      className={`${className} rounded border border-slate-300 dark:border-slate-700`}
      data-tooltip-id="item-tooltip"
      data-tooltip-content={tooltipContent}
    />
  );
};

export default ItemIcon;
