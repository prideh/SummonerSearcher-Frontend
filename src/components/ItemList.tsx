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
}

/**
 * A component that displays a player's item build in a responsive layout.
 * It shows items in a single row on mobile and a 3x2 grid with a separate trinket on desktop.
 */
const ItemList: React.FC<ItemListProps> = ({ mainItems, trinket }) => {
  return (
    <>
      {/* Mobile: Single flex row for all items */}
      <div className="flex md:hidden items-center gap-1">
        {mainItems.map((item, i) => (
          <ItemIcon key={`mobile-main-${i}`} itemId={item} className="w-8 h-8" />
        ))}
        <ItemIcon key="mobile-trinket" itemId={trinket} className="w-8 h-8 ml-1" />
      </div>
      {/* Desktop: 3x2 grid for main items, trinket separate */}
      <div className="hidden md:flex items-center">
        <div className="grid grid-cols-3 gap-1">
          {mainItems.map((item, i) => (
            <ItemIcon key={`desktop-main-${i}`} itemId={item} className="w-8 h-8" />
          ))}
        </div>
        <div className="ml-2">
          <ItemIcon key="desktop-trinket" itemId={trinket} className="w-8 h-8" />
        </div>
      </div>
    </>
  );
};

export default ItemList;
