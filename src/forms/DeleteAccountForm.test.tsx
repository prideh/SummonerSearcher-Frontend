import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DeleteAccountForm from './DeleteAccountForm';
import { deleteUser } from '../api/user';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

// Mock dependencies
vi.mock('../api/user', () => ({
  deleteUser: vi.fn(),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

describe('DeleteAccountForm', () => {
  const mockLogout = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockImplementation((selector: any) => {
      if (selector) return selector({ logout: mockLogout });
      return { logout: mockLogout };
    });
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  it('renders delete account button initially', () => {
    render(<DeleteAccountForm />);
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens modal when button is clicked', async () => {
    render(<DeleteAccountForm />);
    await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    expect(screen.getByText(/are you sure\?/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('closes modal when cancel is clicked', async () => {
    render(<DeleteAccountForm />);
    await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/are you sure\?/i)).not.toBeInTheDocument();
  });

  it('calls deleteUser and logout on successful deletion', async () => {
    render(<DeleteAccountForm />);
    await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await userEvent.type(screen.getByLabelText(/password/i), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: /delete account permanently/i }));

    expect(deleteUser).toHaveBeenCalledWith('Password123!');
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true, state: { message: 'Your account has been successfully deleted.' } });
  });

  it('displays error message on failed deletion', async () => {
    const errorMessage = 'Incorrect password';
    (deleteUser as any).mockRejectedValue(new Error(errorMessage));

    render(<DeleteAccountForm />);
    await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await userEvent.type(screen.getByLabelText(/password/i), 'WrongPass');
    await userEvent.click(screen.getByRole('button', { name: /delete account permanently/i }));

    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
