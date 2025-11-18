import React, { useEffect } from 'react';
import { useDataDragonStore } from '../store/dataDragonStore';

interface ItemIconProps {
  itemId: number | undefined;
  className?: string;
}

const ItemIcon: React.FC<ItemIconProps> = ({ itemId, className = 'w-8 h-8' }) => {
  const { itemMap, fetchItemData } = useDataDragonStore();
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);

  useEffect(() => {
    if (!itemMap) {
      fetchItemData();
    }
  }, [itemMap, fetchItemData]);

  if (!itemId) {
    return <div className={`${className} bg-gray-700/50 rounded`}></div>;
  }

  const item = itemMap?.[itemId];

  const tooltipContent = item ? `
    <div class="text-left max-w-xs">
      <div class="font-bold text-blue-300">${item.name}</div>
      <div class="text-sm text-gray-300 my-2">${item.description}</div>
      <div class="text-sm text-yellow-400">Cost: ${item.gold.total}</div>
    </div>
  ` : 'Loading item data...';

  return (
    <img
      src={`${CDN_URL}/img/item/${itemId}.png`}
      alt={item?.name || `Item ${itemId}`}
      className={`${className} rounded`}
      data-tooltip-id="item-tooltip"
      data-tooltip-html={tooltipContent}
    />
  );
};

export default ItemIcon;
