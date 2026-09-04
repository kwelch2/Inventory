import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { RequireAdmin } from './RequireAdmin';
import { useAuth } from '../contexts/useAuth';

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const signOut = vi.fn(async () => undefined);

const renderAdminRoute = () => render(
  <MemoryRouter initialEntries={['/admin']}>
    <Routes>
      <Route path="/login" element={<div>Login page</div>} />
      <Route path="/admin" element={<RequireAdmin><div>Admin content</div></RequireAdmin>} />
    </Routes>
  </MemoryRouter>
);

describe('RequireAdmin', () => {
  beforeEach(() => {
    signOut.mockClear();
  });

  it('waits for Firebase authentication restoration', () => {
    mockedUseAuth.mockReturnValue({ user: null, loading: true, signInWithGoogle: vi.fn(), signOut });
    renderAdminRoute();
    expect(screen.getByText('Restoring session...')).toBeInTheDocument();
  });

  it('redirects signed-out users to login', () => {
    mockedUseAuth.mockReturnValue({ user: null, loading: false, signInWithGoogle: vi.fn(), signOut });
    renderAdminRoute();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('rejects users outside the admin email domain', () => {
    mockedUseAuth.mockReturnValue({
      user: { email: 'person@example.com' } as User,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut
    });
    renderAdminRoute();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('renders Admin only for the configured domain', () => {
    mockedUseAuth.mockReturnValue({
      user: { email: 'chief@gemfireems.org' } as User,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOut
    });
    renderAdminRoute();
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });
});
