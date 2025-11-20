import { useMemo } from 'react';

/**
 * Defines the structure for tracking password requirement criteria.
 */
export interface PasswordRequirements {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

/**
 * A custom hook that validates a password against a set of requirements.
 * @param password - The password string to validate.
 * @returns An object containing the status of each requirement and an overall validity flag.
 */
export const usePasswordValidation = (password: string) => {
  // useMemo ensures that the validation logic is only re-run when the password changes.
  const passwordRequirements: PasswordRequirements = useMemo(() => ({
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>+\-=_`~;\\[\]\\']/.test(password),
  }), [password]);

  // A derived memoized value that is true only if all individual requirements are met.
  const isPasswordValid = useMemo(() => Object.values(passwordRequirements).every(Boolean), [passwordRequirements]);

  return { passwordRequirements, isPasswordValid };
};