import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * A route guard component for pages that should not be accessible to logged-in users (e.g., login, register).
 * If the user is logged in, it redirects them to the `/search`.
 * Otherwise, it renders the nested routes (children).
 */
const RedirectIfLoggedIn: React.FC = () => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  return isLoggedIn ? <Navigate to="/search" /> : <Outlet />;
};

export default RedirectIfLoggedIn;
