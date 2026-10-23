import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import ProtectedRoute from "./pages/ProtectedRoute";
import { GenericPageSkeleton } from "./components/Skeletons";

// Core Pages (imported directly to keep views instant and active without loading delays)
import Layout from "./pages/Layout";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Resources from "./pages/Resources";
import Requests from "./pages/Requests";

// Staff Layout and Pages
import StaffLayout from "./pages/staff/StaffLayout";
import StaffDashboard from "./pages/staff/StaffDashboard";
import StaffRequests from "./pages/staff/StaffRequests";
import StaffResources from "./pages/staff/StaffResources";
import StaffProfile from "./pages/staff/StaffProfile";
import AssignedRequest from "./pages/staff/AssignedRequests";

export default function App() {
  return (
    <Router>
      <Suspense fallback={<GenericPageSkeleton />}>
        <Routes>
          {/* Root & Login Paths */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* PROTECTED ADMIN SECTION: Wrapped so ONLY Administrators can view any of these pages */}
          <Route 
            element={
              <ProtectedRoute allowedRole="Administrator">
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* PROTECTED STAFF SECTION: Wrapped so Staff members can view operational pages */}
          <Route 
            element={
              <ProtectedRoute allowedRole="Staff">
                <StaffLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
            <Route path="/staff/requests" element={<StaffRequests />} />
            <Route path="/staff/resources" element={<StaffResources />} />
            <Route path="/staff/assigned-requests" element={<AssignedRequest />} />
            <Route path="/staff/profile" element={<StaffProfile />} />
          </Route>

          {/* Fallback Redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
