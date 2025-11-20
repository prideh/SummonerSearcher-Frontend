import React from 'react';
import { useDataDragonStore } from '../store/dataDragonStore';

/**
 * Props for the RoleIcon component.
 */
interface RoleIconProps {
  /** The role string from the API (e.g., 'TOP', 'JUNGLE', 'UTILITY'). */
  role: string | undefined;
  /** Optional additional CSS classes for styling. */
  className?: string;
}

/**
 * Displays an icon representing a player's assigned role/position in the game.
 * It fetches icons from the Community Dragon CDN.
 */
const RoleIcon: React.FC<RoleIconProps> = ({ role, className = 'w-5 h-5' }) => {
  const communityDragonUrl = useDataDragonStore(state => state.communityDragonUrl);
  // Don't render an icon for invalid roles or game modes without assigned positions (like ARAM).
  if (!role || role === 'NONE' || role === 'Invalid') {
    return null;
  }

  const roleName = role.toLowerCase();
  const iconUrl = `${communityDragonUrl}/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${roleName}.png`;

  // Formats the role name for display in the 'alt' and 'title' attributes.
  const formatRole = (role: string) => {
    if (role === 'UTILITY') return 'Support';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  return (
    <img
      src={iconUrl}
      alt={formatRole(role)}
      title={formatRole(role)}
      className={className}
    />
  );
};

export default RoleIcon;