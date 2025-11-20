import React from 'react';
import ItemIcon from './ItemIcon';

interface ItemListProps {
  mainItems: (number | undefined)[];
  trinket: number | undefined;
}

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
