import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ChangePasswordForm from './ChangePasswordForm';
import { changePassword } from '../api/user';


// Mock dependencies
vi.mock('../api/user', () => ({
  changePassword: vi.fn(),
}));

vi.mock('../components/usePasswordValidation', () => ({
  usePasswordValidation: (password: string) => ({
    isPasswordValid: password === 'Valid123!',
    passwordRequirements: [
      { id: 1, text: 'At least 8 characters', met: password.length >= 8 },
    ],
  }),
}));

vi.mock('../components/PasswordRequirements', () => ({
  default: () => <div data-testid="password-requirements">Password Requirements</div>,
}));

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders change password button initially', () => {
    render(<ChangePasswordForm />);
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens modal when button is clicked', async () => {
    render(<ChangePasswordForm />);
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));
    expect(screen.getByText(/change your password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it('closes modal when cancel is clicked', async () => {
    render(<ChangePasswordForm />);
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/change your password/i)).not.toBeInTheDocument();
  });

  it('shows error if new passwords do not match', async () => {
    render(<ChangePasswordForm />);
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    await userEvent.type(screen.getByLabelText(/current password/i), 'OldPass123!');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Mismatch123!');
    
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/new passwords do not match/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('shows error if new password is invalid', async () => {
    render(<ChangePasswordForm />);
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    await userEvent.type(screen.getByLabelText(/current password/i), 'OldPass123!');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'weak');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'weak');
    
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/new password does not meet all requirements/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('shows error if new password is same as old password', async () => {
    render(<ChangePasswordForm />);
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    await userEvent.type(screen.getByLabelText(/current password/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Valid123!');
    
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/new passwords needs to be different/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('calls changePassword on successful submission', async () => {
    render(<ChangePasswordForm />);
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    await userEvent.type(screen.getByLabelText(/current password/i), 'OldPass123!');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Valid123!');
    
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(changePassword).toHaveBeenCalledWith('OldPass123!', 'Valid123!');
    expect(await screen.findByText(/your password has been changed successfully/i)).toBeInTheDocument();
  });

  it('displays error message on failed password change', async () => {
    const errorMessage = 'Incorrect old password';
    (changePassword as any).mockRejectedValue(new Error(errorMessage));

    render(<ChangePasswordForm />);
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    await userEvent.type(screen.getByLabelText(/current password/i), 'WrongPass');
    await userEvent.type(screen.getByLabelText(/^new password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Valid123!');
    
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
  });
});
