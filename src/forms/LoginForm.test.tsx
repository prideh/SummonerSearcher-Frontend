import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginForm from './LoginForm';
import userEvent from '@testing-library/user-event';
import { loginUser } from '../api/auth';
import { useAuthStore } from '../store/authStore';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: {} }),
  useNavigate: () => vi.fn(),
   
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('../api/auth', () => ({
  loginUser: vi.fn(),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('LoginForm', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      return selector({ login: mockLogin });
    });
  });

  it('renders login form correctly', () => {
    render(<LoginForm />);
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates password length', async () => {
    render(<LoginForm />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    expect(screen.getByText(/password must be at least 8 characters long/i)).toBeInTheDocument();
    expect(loginUser).not.toHaveBeenCalled();
  });

  it('calls loginUser and login action on successful submission', async () => {
    (loginUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      jwt: 'fake-token',
      twoFactorEnabled: false,
      darkmodePreference: true,
    });

    render(<LoginForm />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(loginUser).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockLogin).toHaveBeenCalledWith('fake-token', 'test@example.com', false, true);
    });
  });

  it('displays error message on failed login', async () => {
    (loginUser as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginForm />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });


});
