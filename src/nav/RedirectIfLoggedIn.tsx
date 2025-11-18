import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const RedirectIfLoggedIn: React.FC = () => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  return isLoggedIn ? <Navigate to="/dashboard" /> : <Outlet />;
};

export default RedirectIfLoggedIn;
