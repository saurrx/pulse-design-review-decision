import Cookies from "js-cookie";
import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoutes = () => {
  const token = Cookies.get("pl_user");

  if (!token) {
    return <Navigate to="/login" replace />; // TODO: handle this for diff user roles
  }

  return <Outlet />;
};

export default ProtectedRoutes;
