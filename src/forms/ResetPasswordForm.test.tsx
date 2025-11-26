import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ResetPasswordForm from './ResetPasswordForm';
import { validateResetToken, resetPassword } from '../api/auth';
import { useSearchParams, useNavigate, MemoryRouter } from 'react-router-dom';
import { usePasswordValidation } from '../components/usePasswordValidation';

// Mock dependencies
vi.mock('../api/auth', () => ({
  validateResetToken: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

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

describe('ResetPasswordForm', () => {
  const mockNavigate = vi.fn();
  let mockSearchParams: URLSearchParams;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    (useNavigate as any).mockReturnValue(mockNavigate);
    (useSearchParams as any).mockReturnValue([mockSearchParams]);
  });

  it('redirects to login if token is missing', () => {
    mockSearchParams.delete('token');
    render(
      <MemoryRouter>
        <ResetPasswordForm />
      </MemoryRouter>
    );
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('redirects to login if token is invalid', async () => {
    mockSearchParams.set('token', 'invalid-token');
    (validateResetToken as any).mockRejectedValue(new Error('Invalid token'));
    
    render(
      <MemoryRouter>
        <ResetPasswordForm />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { error: 'Invalid token' } });
    });
  });

  it('renders form if token is valid', async () => {
    mockSearchParams.set('token', 'valid-token');
    (validateResetToken as any).mockResolvedValue(true);
    
    render(
      <MemoryRouter>
        <ResetPasswordForm />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.queryByText(/verifying token/i)).not.toBeInTheDocument();
    });
    
    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
  });

  it('shows error if passwords do not match', async () => {
    mockSearchParams.set('token', 'valid-token');
    (validateResetToken as any).mockResolvedValue(true);
    
    render(
      <MemoryRouter>
        <ResetPasswordForm />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Mismatch123!');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('shows error if password is invalid', async () => {
    mockSearchParams.set('token', 'valid-token');
    (validateResetToken as any).mockResolvedValue(true);
    
    render(
      <MemoryRouter>
        <ResetPasswordForm />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'weak');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'weak');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/password does not meet all requirements/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('calls resetPassword on successful submission', async () => {
    mockSearchParams.set('token', 'valid-token');
    (validateResetToken as any).mockResolvedValue(true);
    
    render(
      <MemoryRouter>
        <ResetPasswordForm />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Valid123!');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(resetPassword).toHaveBeenCalledWith('valid-token', 'Valid123!');
    expect(await screen.findByText(/your password has been reset successfully/i)).toBeInTheDocument();
  });

  it('displays error message on failed reset', async () => {
    mockSearchParams.set('token', 'valid-token');
    (validateResetToken as any).mockResolvedValue(true);
    (resetPassword as any).mockRejectedValue(new Error('Reset failed'));
    
    render(
      <MemoryRouter>
        <ResetPasswordForm />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText(/^new password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Valid123!');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('Reset failed')).toBeInTheDocument();
  });
});
