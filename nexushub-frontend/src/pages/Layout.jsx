import React, { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import API, { getMediaUrl } from "../services/api";
import { Bell, Trash2 } from "lucide-react";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const searchRef = useRef(null);
  
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem("user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      try {
        const u = localStorage.getItem("user");
        setUser(u ? JSON.parse(u) : null);
      } catch {
        setUser(null);
      }
    };

    window.addEventListener("userProfileUpdated", handleProfileUpdate);
    window.addEventListener("storage", handleProfileUpdate);
    return () => {
      window.removeEventListener("userProfileUpdated", handleProfileUpdate);
      window.removeEventListener("storage", handleProfileUpdate);
    };
  }, []);

  const userName = user?.name || "Administrator";
  const userRole = user?.role || "Administrator";
  const profilePic = user?.profile_picture || null;
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Notification States
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Global Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ team: [], requests: [] });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await API.get("/notifications");
      setNotifications(res.data || []);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll for new notifications every 10 seconds
    const notifInterval = setInterval(() => {
      fetchNotifications();
    }, 10000);

    // Close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearInterval(notifInterval);
    };
  }, []);

  // Global Search Debounce Effect
  useEffect(() => {
    const fetchGlobalSearch = async () => {
      if (!searchQuery || searchQuery.trim().length === 0) {
        setSearchResults({ team: [], requests: [] });
        setIsSearchOpen(false);
        return;
      }

      setSearchLoading(true);
      try {
        const [membersRes, requestsRes] = await Promise.all([
          API.get("/members").catch(() => ({ data: [] })),
          API.get("/requests").catch(() => ({ data: [] }))
        ]);

        const query = searchQuery.toLowerCase();
        
        const matchedTeam = (membersRes.data || []).filter(m =>
          m.name?.toLowerCase().includes(query) ||
          m.email?.toLowerCase().includes(query) ||
          m.phone?.toLowerCase().includes(query) ||
          m.role?.toLowerCase().includes(query)
        );

        const matchedRequests = (requestsRes.data || []).filter(r =>
          r.request_number?.toLowerCase().includes(query) ||
          r.title?.toLowerCase().includes(query) ||
          r.requested_by?.toLowerCase().includes(query) ||
          r.category?.toLowerCase().includes(query)
        );

        setSearchResults({
          team: matchedTeam.slice(0, 5),
          requests: matchedRequests.slice(0, 5)
        });
        setIsSearchOpen(true);
      } catch (err) {
        console.error("Global search error:", err);
      } finally {
        setSearchLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchGlobalSearch();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleSelectSearchResult = (type) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    if (type === "team") {
      navigate("/members");
    } else if (type === "request") {
      navigate("/requests");
    }
  };


  const handleToggleNotifications = () => {
    setIsNotifOpen(!isNotifOpen);
    setDropdownOpen(false); // Close profile dropdown if open
    setIsSearchOpen(false); // Close search dropdown if open
  };

  // Mark an individual notification as read when clicked
  const handleNotificationClick = async (notif) => {
    if (notif.is_read) return;

    try {
      await API.patch(`/notifications/${notif.id}/read`);
      setNotifications(
        notifications.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await API.delete("/notifications");
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getInitials = (name) => {
    if (!name) return "AD";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const userInitials = getInitials(userName);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const mainLinks = [
    { name: "Dashboard", path: "/dashboard", icon: "📊" },
    { name: "Team Members", path: "/members", icon: "👥" },
    { name: "Resources", path: "/resources", icon: "📦" },
  ];

  const secondaryLinks = [
    { name: "Work Requests", path: "/requests", icon: "📝" },
  ];

  return (
    <div className="h-screen w-screen bg-[#F1F5F9] flex overflow-hidden p-3 gap-3">
      {/* Sleek Dark Mode Sidebar */}
      <aside className="w-64 bg-[#0d0f12] bg-gradient-to-b from-[#14171f] to-[#0a0c10] border border-white/5 rounded-3xl flex flex-col justify-between shrink-0 hidden md:flex text-slate-300 shadow-2xl p-4">
        <div>
          <div className="h-16 flex items-center px-4 mb-4 border-b border-white/5">
            <span className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                ⚡
              </span>
              Nexus<span className="text-blue-500">Hub</span>
            </span>
          </div>

          <nav className="space-y-1.5">
            {mainLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-white/10 text-white shadow-inner border border-white/10 font-semibold"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-sm">{link.icon}</span>
                  {link.name}
                </button>
              );
            })}
          </nav>

          <div className="my-6 px-2 flex items-center gap-3">
            <div className="h-[1px] bg-white/10 flex-1"></div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Management</span>
            <div className="h-[1px] bg-white/10 flex-1"></div>
          </div>

          <nav className="space-y-1.5">
            {secondaryLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-white/10 text-white shadow-inner border border-white/10 font-semibold"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-sm">{link.icon}</span>
                  {link.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/5 px-2 text-center">
          <p className="text-[10px] text-slate-500">NexusHub Admin v1.0</p>
        </div>
      </aside>

      {/* Right Side Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden my-auto bg-[#F8FAFC]">
        <header className="h-20 bg-[#0d0f12] bg-gradient-to-r from-[#14171f] to-[#0a0c10] border-b border-white/5 px-8 flex items-center justify-between shrink-0 z-30 text-white">
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Operations Portal
            </h2>
            <p className="text-[11px] text-slate-400">
              Enterprise Resource & Operations Management
            </p>
          </div>

          {/* GLOBAL TOP BAR SEARCH BAR */}
          <div className="flex-1 max-w-md mx-6 relative" ref={searchRef}>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search team members, requests, phone numbers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.trim()) setIsSearchOpen(true); }}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-inner"
              />
              {searchLoading && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[10px] text-slate-400">
                  Searching...
                </span>
              )}
            </div>

            {/* Global Search Results Dropdown */}
            {isSearchOpen && (searchResults.team.length > 0 || searchResults.requests.length > 0) && (
              <div className="absolute left-0 right-0 mt-2 bg-[#14171f] rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 text-xs divide-y divide-white/5 max-h-96 overflow-y-auto">
                
                {/* Team Members */}
                {searchResults.team.length > 0 && (
                  <div className="p-2">
                    <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Team Members
                    </p>
                    {searchResults.team.map((member) => (
                      <div
                        key={member.id}
                        onClick={() => handleSelectSearchResult("team")}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-white">{member.name}</p>
                          <p className="text-[11px] text-slate-400">{member.email} {member.phone ? `• ${member.phone}` : ""}</p>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-md">
                          {member.role || "Staff"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Work Requests */}
                {searchResults.requests.length > 0 && (
                  <div className="p-2">
                    <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Work Requests
                    </p>
                    {searchResults.requests.map((req) => (
                      <div
                        key={req.id}
                        onClick={() => handleSelectSearchResult("request")}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 rounded-xl transition cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-white">
                            <span className="font-mono text-slate-400 mr-1.5">{req.request_number}</span> 
                            {req.title}
                          </p>
                          <p className="text-[11px] text-slate-400">Requester: {req.requested_by}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.status === "Resolved" || req.status === "Completed" 
                            ? "bg-green-500/20 text-green-400" 
                            : "bg-amber-500/20 text-amber-400"
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell with Individual Click-to-Read */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={handleToggleNotifications}
                className="relative p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition flex items-center justify-center cursor-pointer border border-white/10"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#14171f] animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#14171f] rounded-2xl shadow-2xl border border-white/10 z-50 overflow-hidden text-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                      Notifications
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearNotifications}
                        className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Clear All
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No notifications found.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3.5 transition text-left space-y-1 cursor-pointer ${
                            !notif.is_read
                              ? "bg-blue-950/30 border-l-4 border-rose-500 hover:bg-white/10"
                              : "bg-transparent hover:bg-white/5 opacity-75"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-white flex items-center gap-1.5">
                              {!notif.is_read && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
                              {notif.title}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {new Date(notif.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => {
                  setDropdownOpen(!dropdownOpen);
                  setIsNotifOpen(false);
                  setIsSearchOpen(false);
                }}
                className="flex items-center gap-3 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-2xl border border-white/10 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 shadow-inner">
                  {profilePic ? (
                    <img 
                      src={getMediaUrl(profilePic)} 
                      alt="Profile" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-medium text-white">{userName}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{userRole}</p>
                </div>
                <span className={`text-[10px] text-slate-400 transition-transform duration-200 ml-1 ${dropdownOpen ? "rotate-180" : ""}`}>
                  ▼
                </span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#14171f] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 text-slate-300 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-white/10 mb-1">
                    <p className="text-xs font-bold text-white truncate">{userName}</p>
                    <p className="text-[10px] text-slate-400 truncate capitalize">{userRole}</p>
                  </div>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/profile");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white transition-all text-left font-medium cursor-pointer"
                  >
                    <span>⚙️</span>
                    <span>Profile Settings</span>
                  </button>

                  <div className="h-[1px] bg-white/10 my-1"></div>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-all text-left font-medium cursor-pointer"
                  >
                    <span>🚪</span>
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}