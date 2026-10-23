import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRole }) {
    const location = useLocation();
    const token = localStorage.getItem('token');
    
    let userRole = localStorage.getItem('role');
    if (!userRole) {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                userRole = JSON.parse(storedUser)?.role;
            }
        } catch (e) {}
    }

    // 1. If not logged in at all, redirect cleanly to login page
    if (!token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const normalizedUserRole = (userRole || '').toLowerCase();
    const isAdminOrManager = normalizedUserRole === 'administrator' || normalizedUserRole === 'admin' || normalizedUserRole === 'manager';
    const isStaff = normalizedUserRole === 'staff';

    // 2. If a specific role is required, verify access
    if (allowedRole) {
        const normalizedAllowed = allowedRole.toLowerCase();

        let isAuthorized = false;
        if (normalizedAllowed === 'administrator') {
            isAuthorized = isAdminOrManager;
        } else if (normalizedAllowed === 'staff') {
            isAuthorized = isStaff || isAdminOrManager;
        } else {
            isAuthorized = normalizedUserRole === normalizedAllowed;
        }

        if (!isAuthorized) {
            // Guard against infinite loop if already on the target route
            if (isStaff && location.pathname !== '/staff/dashboard') {
                return <Navigate to="/staff/dashboard" replace />;
            } else if (isAdminOrManager && location.pathname !== '/dashboard') {
                return <Navigate to="/dashboard" replace />;
            }
            return <Navigate to="/login" replace />;
        }
    }

    // 3. If authorized, render the requested page component
    return children;
}
