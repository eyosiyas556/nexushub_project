import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { joinUserRoom } from '../services/socket';
import { Eye, EyeClosed, ArrowLeft } from 'iconoir-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [isWakingServer, setIsWakingServer] = useState(false);

    // Forgot Password Flow States
    const [authView, setAuthView] = useState('login'); 
    const [resetEmail, setResetEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Countdown Timer State (in seconds, e.g., 10 minutes = 600 seconds)
    const [timeLeft, setTimeLeft] = useState(600);
    const [isTimerActive, setIsTimerActive] = useState(false);

    const navigate = useNavigate();

    // Background warm-up ping on mount to start waking Render backend before user clicks submit
    useEffect(() => {
        API.get('/health').catch(() => {});
    }, []);

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

    const executeLogin = async (loginEmail, loginPassword) => {
        setError('');
        setSuccessMsg('');
        setLoading(true);
        setIsWakingServer(false);

        // Show waking notice if request takes > 2.5 seconds (Render free tier spin-up)
        const wakeTimer = setTimeout(() => {
            setIsWakingServer(true);
        }, 2500);

        try {
            const response = await API.post('/auth/login', { 
                email: loginEmail, 
                password: loginPassword 
            });
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('role', user.role);

            // Connect socket to this user's channel for real-time alerts
            if (user?.id) {
                joinUserRoom(user.id);
            }

            const role = (user.role || '').toLowerCase();
            if (role === 'staff') {
                navigate('/staff/dashboard');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
        } finally {
            clearTimeout(wakeTimer);
            setIsWakingServer(false);
            setLoading(false);
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        executeLogin(email, password);
    };

    const handleQuickLogin = (quickEmail, quickPassword) => {
        setEmail(quickEmail);
        setPassword(quickPassword);
        executeLogin(quickEmail, quickPassword);
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
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-3 sm:p-4 md:p-6">
            <div className="bg-[#FFFFFF] border border-gray-100 rounded-3xl shadow-xl overflow-hidden max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 relative">
                
                {/* Left Side Banner */}
                <div className="relative bg-gradient-to-tr from-[#0F172A] to-[#1E293B] p-8 md:p-12 text-white flex flex-col justify-between overflow-hidden hidden md:flex">
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
                <div className="p-5 sm:p-8 md:p-10 flex flex-col justify-center bg-[#FFFFFF]">
                    
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

                    {isWakingServer && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl mb-4 text-xs font-medium flex items-center space-x-2 animate-pulse">
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping mr-1"></span>
                            <span>Connecting to server... Server is spinning up, please wait a moment.</span>
                        </div>
                    )}

                    {/* VIEW 1: LOGIN */}
                    {authView === 'login' && (
                        <>
                            <div className="mb-5">
                                <h3 className="text-2xl font-bold text-[#0F172A]">Sign in</h3>
                                <p className="text-xs text-[#64748B] mt-1">Please enter your credentials to access the system.</p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-3.5">
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
                                            className="px-3 text-[#64748B] hover:text-[#0F172A] focus:outline-none cursor-pointer transition flex items-center justify-center"
                                            title={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 bg-[#0F172A] hover:bg-black rounded-xl font-semibold transition duration-200 text-white text-sm shadow-md mt-1 cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? "Signing in..." : "Sign in"}
                                </button>
                            </form>

                            {/* Portfolio Demo Credentials Card */}
                            <div className="mt-5 pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-2.5">
                                    <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                                        Portfolio Demo Credentials
                                    </p>
                                    <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                                        Reviewer Access
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {/* Admin Card */}
                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between hover:border-slate-300 transition">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[11px] font-bold text-slate-900">Administrator</span>
                                                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Full</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 font-mono select-all truncate" title="eyosiyasfisseha51@gmail.com">
                                                eyosiyasfisseha51@gmail.com
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                Pass: <span className="font-semibold text-slate-800">admin123</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEmail('eyosiyasfisseha51@gmail.com');
                                                    setPassword('admin123');
                                                }}
                                                className="flex-1 py-1 px-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 transition cursor-pointer text-center"
                                            >
                                                Auto-fill
                                            </button>
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => handleQuickLogin('eyosiyasfisseha51@gmail.com', 'admin123')}
                                                className="flex-1 py-1 px-1.5 bg-[#0F172A] hover:bg-black rounded-lg text-[10px] font-semibold text-white transition cursor-pointer disabled:opacity-50 text-center shadow-xs"
                                            >
                                                Sign in
                                            </button>
                                        </div>
                                    </div>

                                    {/* Staff Card */}
                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between hover:border-slate-300 transition">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[11px] font-bold text-slate-900">Staff</span>
                                                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Portal</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 font-mono select-all truncate" title="fiker51@gmail.com">
                                                fiker51@gmail.com
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                Pass: <span className="font-semibold text-slate-800">fiker123</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEmail('fiker51@gmail.com');
                                                    setPassword('fiker123');
                                                }}
                                                className="flex-1 py-1 px-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 transition cursor-pointer text-center"
                                            >
                                                Auto-fill
                                            </button>
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => handleQuickLogin('fiker51@gmail.com', 'fiker123')}
                                                className="flex-1 py-1 px-1.5 bg-slate-800 hover:bg-slate-900 rounded-lg text-[10px] font-semibold text-white transition cursor-pointer disabled:opacity-50 text-center shadow-xs"
                                            >
                                                Sign in
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                                        className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer inline-flex items-center gap-1 transition"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign in
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
