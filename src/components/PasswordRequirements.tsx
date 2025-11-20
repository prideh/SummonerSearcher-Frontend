import React from 'react';
import type { PasswordRequirements as PasswordRequirementsType } from './usePasswordValidation';

interface PasswordRequirementsProps {
  requirements: PasswordRequirementsType;
  className?: string;
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ requirements, className }) => {
  return (
    <div className={`p-4 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-lg z-10 transition-opacity duration-300 ease-in-out ${className}`}>
      <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2">Password must contain:</h4>
      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <li className={requirements.minLength ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}>At least 8 characters</li>
        <li className={requirements.hasUpper ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}>An uppercase letter</li>
        <li className={requirements.hasLower ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}>A lowercase letter</li>
        <li className={requirements.hasNumber ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}>A number</li>
        <li className={requirements.hasSpecial ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}>A special character (!@#$...)</li>
      </ul>
    </div>
  );
};

export default PasswordRequirements;