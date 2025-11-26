import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegistrationForm from './RegistrationForm';
import userEvent from '@testing-library/user-event';
import { registerUser } from '../api/auth';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('../api/auth', () => ({
  registerUser: vi.fn(),
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

describe('RegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form correctly', () => {
    render(<RegistrationForm />);
    expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('shows error if passwords do not match', async () => {
    render(<RegistrationForm />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Mismatch123!');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));
    
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it('shows error if password is invalid', async () => {
    render(<RegistrationForm />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'weak');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'weak');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));
    
    expect(await screen.findByText(/password does not meet all requirements/i)).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it('calls registerUser on successful submission', async () => {
    (registerUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<RegistrationForm />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Valid123!');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));
    
    await waitFor(() => {
      expect(registerUser).toHaveBeenCalledWith('test@example.com', 'Valid123!');
    });
  });

  it('displays error message on failed registration', async () => {
    (registerUser as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Email already exists'));

    render(<RegistrationForm />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Valid123!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Valid123!');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });
});
