import { Navigate, Outlet, useLocation } from "react-router-dom";
import Spinner from "../components/ui/Spinner.jsx";
import useAuth from "../hooks/useAuth.js";
import { APP_ROUTES } from "../utils/constants.js";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <Spinner label="Verifico la sessione" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={APP_ROUTES.login} state={{ from: location }} replace />;
  }

  return children ?? <Outlet />;
}
