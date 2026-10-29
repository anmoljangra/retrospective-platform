import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { AuthProvider } from './AuthContext';

describe('LoginPage Component', () => {
  it('renders login form with email and password inputs', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/alex@acme.corp/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates required fields before submitting', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    // Form validation should display validation error for empty email
    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
  });
});
