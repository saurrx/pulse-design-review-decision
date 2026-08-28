import Cookies from "js-cookie";
import { Navigate, Outlet } from "react-router-dom";

const PublicRoutes = () => {
  const token = Cookies.get("pl_user");

  if (token) {
    return <Navigate to="/" replace />; // TODO: handle this for diff user roles
  }

  return <Outlet />;
};

export default PublicRoutes;
