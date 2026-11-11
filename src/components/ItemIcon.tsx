import React, { useEffect, useState } from 'react';
import { useDataDragonStore } from '../store/dataDragonStore';
import { VERIFIED_ROLE_QUEST_METADATA } from '../utils/roleQuestUtils';

interface ItemIconProps {
  itemId: number | null | undefined;
  className?: string;
  isRoleBoundSlot?: boolean;
}

const ItemIcon: React.FC<ItemIconProps> = ({
  itemId,
  className = 'w-8 h-8',
  isRoleBoundSlot = false,
}) => {
  const itemMap = useDataDragonStore(state => state.itemMap);
  const CDN_URL = useDataDragonStore(state => state.cdnUrl);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [itemId, CDN_URL]);

  if (!itemId || itemId <= 0) {
    return (
      <div
        className={`${className} bg-slate-200/75 dark:bg-slate-900/75 border border-slate-300/70 dark:border-slate-800 rounded`}
      />
    );
  }

  const item = itemMap?.[itemId];
  const questMeta = VERIFIED_ROLE_QUEST_METADATA[itemId];
  const resolvedName = item?.name || questMeta?.name || `Item #${itemId}`;
  const slotPrefix = isRoleBoundSlot
    ? '<div class="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-0.5">Role Quest / 7th Slot</div>'
    : '';

  const tooltipContent = item
    ? `
    <div class="text-left max-w-xs">
      ${slotPrefix}
      <div class="font-bold text-cyan-500 dark:text-cyan-400">${item.name}</div>
      <div class="text-sm text-gray-200 dark:text-gray-300 my-2">${item.description}</div>
      <div class="text-sm text-yellow-400">Cost: ${item.gold.total}</div>
    </div>
  `
    : questMeta
    ? `
    <div class="text-left max-w-xs">
      ${slotPrefix}
      <div class="font-bold text-amber-400">${questMeta.name}</div>
      <div class="text-sm text-gray-200 dark:text-gray-300 my-1.5">${questMeta.summary}</div>
    </div>
  `
    : `
    <div class="text-left max-w-xs">
      ${slotPrefix}
      <div class="font-bold text-cyan-400">Item #${itemId}</div>
      <div class="text-xs text-gray-300 mt-1">Icon or metadata unavailable in current Data Dragon snapshot.</div>
    </div>
  `;

  const borderClasses = isRoleBoundSlot
    ? 'ring-1 ring-amber-400/80 border-amber-500/80 dark:border-amber-400/80'
    : 'border-slate-300 dark:border-slate-700';

  if (!CDN_URL || imgFailed) {
    const badgeLabel = questMeta
      ? questMeta.kind === 'quest_starter'
        ? 'Q'
        : questMeta.kind === 'quest_reward'
        ? 'QR'
        : 'T3'
      : String(itemId).slice(-4);
    return (
      <div
        role="img"
        aria-label={resolvedName}
        data-testid={`item-fallback-${itemId}`}
        data-tooltip-id="item-tooltip"
        data-tooltip-content={tooltipContent}
        className={`${className} rounded border ${borderClasses} bg-slate-800/90 text-amber-300 flex items-center justify-center text-[9px] font-extrabold leading-none select-none shrink-0`}
      >
        {badgeLabel}
      </div>
    );
  }

  return (
    <img
      src={`${CDN_URL}/img/item/${itemId}.png`}
      loading="lazy"
      alt={resolvedName}
      onError={() => setImgFailed(true)}
      className={`${className} rounded border ${borderClasses} shrink-0`}
      data-tooltip-id="item-tooltip"
      data-tooltip-content={tooltipContent}
    />
  );
};

export default ItemIcon;

