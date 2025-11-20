import React from 'react';
import { useDataDragonStore } from '../store/dataDragonStore';

interface RoleIconProps {
  role: string | undefined;
  className?: string;
}

const RoleIcon: React.FC<RoleIconProps> = ({ role, className = 'w-5 h-5' }) => {
  const communityDragonUrl = useDataDragonStore(state => state.communityDragonUrl);
  if (!role || role === 'NONE' || role === 'Invalid') {
    return null; // Don't render an icon for ARAM or invalid positions
  }

  const roleName = role.toLowerCase();
  const iconUrl = `${communityDragonUrl}/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${roleName}.png`;

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