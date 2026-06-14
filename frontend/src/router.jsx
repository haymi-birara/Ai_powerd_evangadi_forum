import { createBrowserRouter, Navigate } from "react-router-dom";
import AskQuestion from "./pages/questions/AskQuestion";

// Import your existing pages
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

// Protected Route Check
const requireAuth = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return null;
};

export const router = createBrowserRouter([
  // Public Routes
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/auth",
    element: <Auth />,
  },

  // Protected Routes (require login)
  {
    path: "/dashboard",
    loader: requireAuth,
    element: <Dashboard />,
  },

  // T-15: Post Question Page
  {
    path: "/questions/ask",
    loader: requireAuth,
    element: <AskQuestion />,
  },

  // 404
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
