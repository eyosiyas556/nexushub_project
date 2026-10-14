import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    // Forgot Password Flow States (now using email instead of phone)
    const [authView, setAuthView] = useState('login'); 
    const [resetEmail, setResetEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Countdown Timer State (in seconds, e.g., 10 minutes = 600 seconds)
    const [timeLeft, setTimeLeft] = useState(600);
    const [isTimerActive, setIsTimerActive] = useState(false);

    const navigate = useNavigate();

    // Timer effect for OTP expiry countdown
    useEffect(() => {
        let timer;
        if (authView === 'verify_otp' && isTimerActive && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsTimerActive(false);
        }
        return () => clearInterval(timer);
    }, [authView, isTimerActive, timeLeft]);

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const response = await API.post('/auth/login', { email, password });
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('role', user.role);

            const role = (user.role || '').toLowerCase();
            if (role === 'staff') {
                navigate('/staff/dashboard');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const res = await API.post('/auth/forgot-password', { email: resetEmail });
            setSuccessMsg(res.data.message || 'OTP sent successfully to your email!');
            if (res.data.debugOtp) {
                console.log('Debug OTP:', res.data.debugOtp);
            }
            setAuthView('verify_otp');
            setTimeLeft(600); // Reset timer to 10 minutes
            setIsTimerActive(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP email.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const res = await API.post('/auth/reset-password-otp', {
                email: resetEmail,
                otp,
                newPassword,
            });
            setSuccessMsg(res.data.message || 'Password reset successfully!');
            setTimeout(() => {
                setAuthView('login');
                setResetEmail('');
                setOtp('');
                setNewPassword('');
                setSuccessMsg('');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password. Invalid or expired OTP.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
            <div className="bg-[#FFFFFF] border border-gray-100 rounded-3xl shadow-xl overflow-hidden max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 relative">
                
                {/* Left Side Banner */}
                <div className="relative bg-gradient-to-tr from-[#0F172A] to-[#1E293B] p-10 md:p-12 text-white flex flex-col justify-between overflow-hidden hidden md:flex">
                    <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-black rounded-full mix-blend-multiply filter blur-xl opacity-70"></div>
                    <div className="absolute bottom-10 right-[-40px] w-48 h-48 bg-slate-800 rounded-full mix-blend-multiply filter blur-lg opacity-60"></div>

                    <div className="relative z-10">
                        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-white">WELCOME</h1>
                        <h2 className="text-xl font-semibold text-slate-300 mb-4">NEXUSHUB PORTAL</h2>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            Centralized resource allocation, inventory tracking, and operations management for secure, efficient administration.
                        </p>
                    </div>

                    <div className="relative z-10 text-xs text-slate-400 font-medium">
                        Enterprise Operations & Resource System
                    </div>
                </div>

                {/* Right Side Forms */}
                <div className="p-8 md:p-12 flex flex-col justify-center bg-[#FFFFFF]">
                    
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-xl mb-4 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl mb-4 text-xs font-medium">
                            {successMsg}
                        </div>
                    )}

                    {/* VIEW 1: LOGIN */}
                    {authView === 'login' && (
                        <>
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-[#0F172A]">Sign in</h3>
                                <p className="text-xs text-[#64748B] mt-1">Please enter your credentials to access the system.</p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-[#64748B] mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 bg-[#F8FAFC] rounded-xl border border-gray-200 focus:outline-none focus:border-[#0F172A] text-[#0F172A] text-sm transition"
                                        placeholder="admin@nexushub.com"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-medium text-[#64748B]">Password</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAuthView('forgot_email');
                                                setError('');
                                                setSuccessMsg('');
                                            }}
                                            className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                    <div className="relative flex items-center bg-[#F8FAFC] border border-gray-200 rounded-xl focus-within:border-[#0F172A] transition">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="w-full px-3.5 py-2.5 bg-transparent text-sm text-[#0F172A] focus:outline-none"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-xs font-semibold text-[#0F172A] hover:text-black px-3 focus:outline-none uppercase tracking-wider cursor-pointer"
                                        >
                                            {showPassword ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-[#0F172A] hover:bg-black rounded-xl font-semibold transition duration-200 text-white text-sm shadow-md mt-2 cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? "Signing in..." : "Sign in"}
                                </button>
                            </form>
                        </>
                    )}

                    {/* VIEW 2: FORGOT EMAIL INPUT */}
                    {authView === 'forgot_email' && (
                        <>
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-[#0F172A]">Reset Password</h3>
                                <p className="text-xs text-[#64748B] mt-1">Enter your registered email address to receive a verification code.</p>
                            </div>

                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-[#64748B] mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 bg-[#F8FAFC] rounded-xl border border-gray-200 focus:outline-none focus:border-[#0F172A] text-[#0F172A] text-sm transition"
                                        placeholder="user@nexushub.com"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-[#0F172A] hover:bg-black rounded-xl font-semibold transition duration-200 text-white text-sm shadow-md mt-2 cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? "Sending OTP..." : "Send Reset Code"}
                                </button>

                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthView('login');
                                            setError('');
                                            setSuccessMsg('');
                                        }}
                                        className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                                    >
                                        ← Back to Sign in
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* VIEW 3: VERIFY OTP WITH COUNTDOWN TIMER */}
                    {authView === 'verify_otp' && (
                        <>
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-[#0F172A]">Enter OTP Code</h3>
                                    <p className="text-xs text-[#64748B] mt-1">
                                        Code sent to <strong className="text-[#0F172A]">{resetEmail}</strong>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${timeLeft > 0 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {timeLeft > 0 ? formatTime(timeLeft) : 'Expired'}
                                    </span>
                                </div>
                            </div>

                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-[#64748B] mb-1">6-Digit OTP</label>
                                    <input
                                        type="text"
                                        maxLength="6"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 bg-[#F8FAFC] rounded-xl border border-gray-200 focus:outline-none focus:border-[#0F172A] text-[#0F172A] text-sm tracking-widest font-mono text-center transition"
                                        placeholder="123456"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-[#64748B] mb-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 bg-[#F8FAFC] rounded-xl border border-gray-200 focus:outline-none focus:border-[#0F172A] text-[#0F172A] text-sm transition"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || timeLeft === 0}
                                    className="w-full py-3 bg-[#0F172A] hover:bg-black rounded-xl font-semibold transition duration-200 text-white text-sm shadow-md mt-2 cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? "Updating..." : "Reset Password"}
                                </button>

                                <div className="flex items-center justify-between pt-2 text-xs font-semibold">
                                    <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        className="text-blue-600 hover:underline cursor-pointer"
                                    >
                                        Resend Code
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthView('forgot_email');
                                            setError('');
                                            setSuccessMsg('');
                                        }}
                                        className="text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                                    >
                                        Change Email
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                </div>

            </div>
        </div>
    );
}