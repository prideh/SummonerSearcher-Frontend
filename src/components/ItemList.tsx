import React from 'react';
import ItemIcon from './ItemIcon';

/**
 * Props for the ItemList component.
 */
interface ItemListProps {
  /** An array of item IDs for the main 6 inventory slots. */
  mainItems: (number | undefined)[];
  /** The item ID for the trinket slot. */
  trinket: number | undefined;
  /** Optional Season 2026 Role Quest / 7th-slot item ID (null/undefined on legacy cache -> omitted, never 0). */
  roleBoundItem?: number | null;
}

/**
 * A component that displays a player's item build in a responsive layout.
 * Renders the Season 2026 `roleBoundItem` (7th-slot boots or Role Quest item) when positive,
 * while never fabricating an empty/zero slot for legacy `null`/`undefined` entries.
 */
const ItemList: React.FC<ItemListProps> = ({ mainItems, trinket, roleBoundItem }) => {
  const hasRoleBound = typeof roleBoundItem === 'number' && roleBoundItem > 0;

  return (
    <>
      {/* Mobile: Single flex row for all items */}
      <div className="flex md:hidden items-center gap-1 flex-wrap">
        {mainItems.map((item, i) => (
          <ItemIcon key={`mobile-main-${i}`} itemId={item} className="w-8 h-8" />
        ))}
        <ItemIcon key="mobile-trinket" itemId={trinket} className="w-8 h-8 ml-1" />
        {hasRoleBound && (
          <ItemIcon
            key="mobile-role-bound"
            itemId={roleBoundItem}
            isRoleBoundSlot
            className="w-8 h-8 ml-0.5"
          />
        )}
      </div>
      {/* Desktop: 3x2 grid for main items, trinket + optional Role Quest / 7th slot separate */}
      <div className="hidden md:flex items-center">
        <div className="grid grid-cols-3 gap-1">
          {mainItems.map((item, i) => (
            <ItemIcon key={`desktop-main-${i}`} itemId={item} className="w-8 h-8" />
          ))}
        </div>
        <div className="ml-2 flex flex-col gap-1 items-center">
          <ItemIcon key="desktop-trinket" itemId={trinket} className="w-8 h-8" />
          {hasRoleBound && (
            <ItemIcon
              key="desktop-role-bound"
              itemId={roleBoundItem}
              isRoleBoundSlot
              className="w-7 h-7"
            />
          )}
        </div>
      </div>
    </>
  );
};

export default ItemList;
