import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import API from '../services/api';
import { joinUserRoom } from '../services/socket';
import { GenericPageSkeleton } from '../components/Skeletons';

export default function ProtectedRoute({ children, allowedRole }) {
    const location = useLocation();
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [userRole, setUserRole] = useState(() => {
        let role = localStorage.getItem('role');
        if (!role) {
            try {
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    role = JSON.parse(storedUser)?.role;
                }
            } catch (e) {}
        }
        return role;
    });
    const [isAuthenticating, setIsAuthenticating] = useState(!token);

    // Auto-authenticate portfolio visitors if visiting without a session
    useEffect(() => {
        if (!token) {
            let isMounted = true;
            const endpoint = allowedRole?.toLowerCase() === 'staff' ? '/auth/demo-staff' : '/auth/demo-admin';
            API.get(endpoint)
                .then((res) => {
                    if (!isMounted) return;
                    const { token: demoToken, user: demoUser } = res.data;
                    localStorage.setItem('token', demoToken);
                    localStorage.setItem('user', JSON.stringify(demoUser));
                    localStorage.setItem('role', demoUser.role);
                    if (demoUser?.id) {
                        joinUserRoom(demoUser.id);
                    }
                    setToken(demoToken);
                    setUserRole(demoUser.role);
                    setIsAuthenticating(false);
                })
                .catch((err) => {
                    console.error("Auto-demo auth failed:", err);
                    if (isMounted) {
                        setIsAuthenticating(false);
                    }
                });
            return () => {
                isMounted = false;
            };
        }
    }, [token, allowedRole]);

    if (isAuthenticating) {
        return <GenericPageSkeleton />;
    }

    // 1. If not logged in at all, redirect to login page
    if (!token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
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