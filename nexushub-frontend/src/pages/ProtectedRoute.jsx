import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRole }) {
    const token = localStorage.getItem('token');
    
    // Retrieve role from standalone item or fallback to parsed user object
    let userRole = localStorage.getItem('role');
    if (!userRole) {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                userRole = parsedUser?.role;
            }
        } catch (e) {
            console.error("Failed to parse user session in ProtectedRoute", e);
        }
    }

    // 1. If not logged in at all, redirect to login page
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    const normalizedUserRole = (userRole || '').toLowerCase();
    const isAdminOrManager = normalizedUserRole === 'administrator' || normalizedUserRole === 'admin' || normalizedUserRole === 'manager';
    const isStaff = normalizedUserRole === 'staff';

    // 2. If a specific role is required
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
            if (isStaff) {
                return <Navigate to="/staff/dashboard" replace />;
            } else if (isAdminOrManager) {
                return <Navigate to="/dashboard" replace />;
            }
            return <Navigate to="/login" replace />;
        }
    }

    // 3. If authorized, render the requested page component
    return children;
}