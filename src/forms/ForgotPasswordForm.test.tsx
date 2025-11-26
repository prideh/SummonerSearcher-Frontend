import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ForgotPasswordForm from './ForgotPasswordForm';
import { forgotPassword } from '../api/auth';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('../api/auth', () => ({
  forgotPassword: vi.fn(),
}));

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    render(
      <BrowserRouter>
        <ForgotPasswordForm />
      </BrowserRouter>
    );
  };

  it('renders forgot password form correctly', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
  });

  it('calls forgotPassword on successful submission', async () => {
    (forgotPassword as any).mockResolvedValue('Reset link sent');  
    renderComponent();

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(forgotPassword).toHaveBeenCalledWith('test@example.com');
    expect(await screen.findByText(/reset link sent/i)).toBeInTheDocument();
  });

  it('displays error message on failed submission', async () => {
    const errorMessage = 'Email not found';
    (forgotPassword as any).mockRejectedValue(new Error(errorMessage));  

    renderComponent();

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
  });
});
