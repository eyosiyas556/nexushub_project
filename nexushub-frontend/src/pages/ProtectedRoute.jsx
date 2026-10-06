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
        return <Navigate to="/" replace />;
    }

    // 2. If a specific role is required and doesn't match (case-insensitive)
    if (allowedRole && userRole?.toLowerCase() !== allowedRole?.toLowerCase()) {
        // Redirect dynamically based on the user's actual role
        if (userRole?.toLowerCase() === 'staff') {
            return <Navigate to="/staff/dashboard" replace />;
        }
        return <Navigate to="/dashboard" replace />;
    }

    // 3. If authorized, render the requested page component
    return children;
}