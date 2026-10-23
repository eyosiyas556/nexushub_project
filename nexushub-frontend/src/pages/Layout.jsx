import React, { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import API, { getMediaUrl } from "../services/api";
import { 
  Bell, 
  Trash, 
  ViewGrid, 
  Group, 
  Packages, 
  TaskList, 
  Search, 
  NavArrowDown, 
  Settings, 
  LogOut, 
  Flash,
  Menu,
  Xmark,
  NavArrowLeft,
  NavArrowRight
} from "iconoir-react";
import socket, { joinUserRoom } from "../services/socket";
import ConfirmationModal from "../components/ConfirmationModal";
import { clearSessionCache } from "../services/cache";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const searchRef = useRef(null);
  const [isConfirmClearNotifOpen, setIsConfirmClearNotifOpen] = useState(false);
  
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
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [profilePic]);

  // Notification States
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Global Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ team: [], requests: [] });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Mobile Navigation Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Tablet/Desktop Collapsible Sidebar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const fetchNotifications = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await API.get("/notifications");
      const freshList = res.data || [];
      setNotifications(freshList);
      autoClearPageNotifications(freshList);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  // Auto-mark notifications as read if user is already on the page related to the notification
  const autoClearPageNotifications = async (notifsList) => {
    const list = notifsList || notifications;
    if (!list || list.length === 0) return;

    const currentPath = location.pathname;
    const toClear = list.filter((n) => {
      if (n.is_read) return false;
      const target = getNotificationRedirect(n);
      if (!target) return false;
      return currentPath === target || currentPath.startsWith(target);
    });

    if (toClear.length > 0) {
      const toClearIds = new Set(toClear.map((n) => n.id));
      setNotifications((prev) =>
        prev.map((n) => (toClearIds.has(n.id) ? { ...n, is_read: true } : n))
      );
      for (const notif of toClear) {
        try {
          await API.patch(`/notifications/${notif.id}/read`);
        } catch (err) {}
      }
    }
  };

  // Auto-dismiss notification badges when navigating directly to the related page
  useEffect(() => {
    autoClearPageNotifications(notifications);
  }, [location.pathname]);

  useEffect(() => {
    fetchNotifications();

    if (user?.id) {
      joinUserRoom(user.id);
    }

    const handleLiveNotifications = () => {
      fetchNotifications(true);
    };

    const handleMembersUpdated = () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        API.get("/members").then((res) => {
          const u = JSON.parse(storedUser);
          const freshMe = (res.data || []).find((m) => m.id === u.id);
          if (freshMe) {
            const merged = { ...u, ...freshMe };
            localStorage.setItem("user", JSON.stringify(merged));
            setUser(merged);
          }
        }).catch(() => {});
      }
    };

    // Real-time: refresh notifications instantly when backend emits the event
    socket.on("notifications_updated", handleLiveNotifications);
    socket.on("members_updated", handleMembersUpdated);

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
      socket.off("notifications_updated", handleLiveNotifications);
      socket.off("members_updated", handleMembersUpdated);
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
    setMobileSearchOpen(false);
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

  // Determine which admin page to navigate to based on notification content
  function getNotificationRedirect(notif) {
    const title = (notif.title || "").toLowerCase();
    const msg = (notif.message || "").toLowerCase();

    // Activation, deactivation, status, or account profile notifications do NOT redirect
    if (
      title.includes("activat") ||
      title.includes("deactivat") ||
      title.includes("profile") ||
      title.includes("account") ||
      title.includes("security") ||
      title.includes("password") ||
      msg.includes("deactivated") ||
      msg.includes("activated") ||
      msg.includes("profile") ||
      msg.includes("status: active") ||
      msg.includes("status: inactive")
    ) {
      return null;
    }

    // 1. Resource-related notifications -> /resources
    if (
      title.includes("resource") || 
      title.includes("asset") || 
      title.includes("inventory") ||
      msg.includes("released resource") || 
      msg.includes("resource available") || 
      msg.includes("available for request") ||
      (msg.includes("resource") && !title.includes("request"))
    ) {
      return "/resources";
    }

    // 2. Work requests -> /requests
    if (
      title.includes("request") || 
      msg.includes("request") || 
      title.includes("task")
    ) {
      return "/requests";
    }

    // All other notifications do NOT redirect
    return null;
  };

  // Mark notification as read and redirect only if associated with resources or requests
  const handleNotificationClick = async (notif) => {
    const redirectPath = getNotificationRedirect(notif);

    // Mark as read if still unread
    if (!notif.is_read) {
      try {
        await API.patch(`/notifications/${notif.id}/read`);
        setNotifications(
          notifications.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }

    // Close panel
    setIsNotifOpen(false);

    // ONLY redirect if there is an associated resource or request page
    if (redirectPath) {
      const combinedText = `${notif.title || ""} ${notif.message || ""}`;
      const reqMatch = combinedText.match(/REQ-[\w\d-]+/i);
      let highlightKey = reqMatch ? reqMatch[0] : null;

      if (!highlightKey && redirectPath.includes("resource")) {
        const resMatch = combinedText.match(/resource\s+([A-Za-z0-9_-]+)/i) ||
                         combinedText.match(/\b([A-Z]{2,5}-\d+)\b/i);
        highlightKey = resMatch ? resMatch[1] : null;
      }

      if (highlightKey) {
        navigate(`${redirectPath}?highlight=${encodeURIComponent(highlightKey)}`);
      } else {
        navigate(redirectPath);
      }
    }
  };

  const executeClearNotifications = async () => {
    try {
      await API.delete("/notifications");
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    } finally {
      setIsConfirmClearNotifOpen(false);
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
    clearSessionCache();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const mainLinks = [
    { name: "Dashboard", path: "/dashboard", icon: <ViewGrid className="w-4 h-4" /> },
    { name: "Team Members", path: "/members", icon: <Group className="w-4 h-4" /> },
    { name: "Resources", path: "/resources", icon: <Packages className="w-4 h-4" /> },
  ];

  const secondaryLinks = [
    { name: "Work Requests", path: "/requests", icon: <TaskList className="w-4 h-4" /> },
  ];

  return (
    <div className="h-screen w-screen bg-[#F1F5F9] flex overflow-hidden p-0 md:p-3 md:gap-3">
      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0d0f12] bg-gradient-to-b from-[#14171f] to-[#0a0c10] border-r border-white/10 h-full p-4 flex flex-col justify-between text-slate-300 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div>
              <div className="h-16 flex items-center justify-between px-3 mb-4 border-b border-white/5">
                <span className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                    <Flash className="w-4 h-4 fill-white text-white" />
                  </span>
                  Nexus<span className="text-blue-500">Hub</span>
                </span>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                  aria-label="Close Menu"
                >
                  <Xmark className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1.5">
                {mainLinks.map((link) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <button
                      key={link.path}
                      onClick={() => {
                        navigate(link.path);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-medium transition-all duration-300 ${
                        isActive ? "bg-white/10 text-white shadow-inner border border-white/10 font-semibold" : "text-slate-400 hover:bg-white/5 hover:text-white"
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
                      onClick={() => {
                        navigate(link.path);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-medium transition-all duration-300 ${
                        isActive ? "bg-white/10 text-white shadow-inner border border-white/10 font-semibold" : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="text-sm">{link.icon}</span>
                      {link.name}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-white/10 px-2 flex items-center justify-between">
              <p className="text-[10px] text-slate-500">NexusHub Admin</p>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Dark Mode Sidebar (Desktop & Tablet) */}
      <aside className={`bg-[#0d0f12] bg-gradient-to-b from-[#14171f] to-[#0a0c10] border border-white/5 rounded-3xl flex flex-col justify-between shrink-0 hidden md:flex text-slate-300 shadow-2xl transition-all duration-300 ${
        sidebarCollapsed ? "w-20 p-3" : "w-56 lg:w-64 p-4"
      }`}>
        <div>
          <div className={`h-16 flex items-center mb-4 border-b border-white/5 ${
            sidebarCollapsed ? "justify-center px-1" : "justify-between px-2"
          }`}>
            <span className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2.5 overflow-hidden">
              <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
                <Flash className="w-4 h-4 fill-white text-white" />
              </span>
              {!sidebarCollapsed && (
                <span className="truncate">Nexus<span className="text-blue-500">Hub</span></span>
              )}
            </span>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer hidden md:flex items-center justify-center shrink-0"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              aria-label={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <NavArrowRight className="w-4 h-4" /> : <NavArrowLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="space-y-1.5">
            {mainLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  title={sidebarCollapsed ? link.name : ""}
                  className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-medium transition-all duration-300 ${
                    sidebarCollapsed ? "justify-center" : ""
                  } ${
                    isActive ? "bg-white/10 text-white shadow-inner border border-white/10 font-semibold" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-sm shrink-0">{link.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{link.name}</span>}
                </button>
              );
            })}
          </nav>

          {!sidebarCollapsed ? (
            <div className="my-6 px-2 flex items-center gap-3">
              <div className="h-[1px] bg-white/10 flex-1"></div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Management</span>
              <div className="h-[1px] bg-white/10 flex-1"></div>
            </div>
          ) : (
            <div className="my-4 h-[1px] bg-white/10 mx-2"></div>
          )}

          <nav className="space-y-1.5">
            {secondaryLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  title={sidebarCollapsed ? link.name : ""}
                  className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl text-xs font-medium transition-all duration-300 ${
                    sidebarCollapsed ? "justify-center" : ""
                  } ${
                    isActive ? "bg-white/10 text-white shadow-inner border border-white/10 font-semibold" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-sm shrink-0">{link.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{link.name}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/10 px-1 text-center">
          {!sidebarCollapsed ? (
            <p className="text-[10px] text-slate-500 truncate">NexusHub Admin v1.0</p>
          ) : (
            <p className="text-[9px] text-slate-500">v1.0</p>
          )}
        </div>
      </aside>

      {/* Right Side Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full rounded-none md:rounded-3xl shadow-sm border-0 md:border border-slate-200/60 overflow-hidden my-auto bg-[#F8FAFC]">
        <header className="h-16 md:h-20 bg-[#14171f] border-b border-white/5 px-3 sm:px-6 md:px-8 flex items-center justify-between shrink-0 z-30 text-white gap-2 sm:gap-4 relative">
          {/* Mobile Full-Width Search Overlay (< sm) */}
          {mobileSearchOpen && (
            <div className="absolute inset-0 bg-[#14171f] px-3.5 flex items-center gap-2 z-40 sm:hidden animate-in fade-in duration-150">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Search className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  autoFocus
                  placeholder="Search team, requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchQuery.trim()) setIsSearchOpen(true); }}
                  className="w-full pl-9 pr-8 py-2 bg-white/10 border border-white/15 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setIsSearchOpen(false); }}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <Xmark className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => { setMobileSearchOpen(false); setIsSearchOpen(false); setSearchQuery(""); }}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition cursor-pointer shrink-0"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white md:hidden transition cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile NexusHub Flash Logo Icon */}
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 md:hidden shrink-0">
              <Flash className="w-4 h-4 fill-white text-white" />
            </div>

            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate max-w-[130px] sm:max-w-none">
                <span className="md:hidden">
                  {location.pathname === "/dashboard" ? "Dashboard" :
                   location.pathname === "/members" ? "Team Members" :
                   location.pathname === "/resources" ? "Resources" :
                   location.pathname === "/requests" ? "Work Requests" :
                   location.pathname === "/profile" ? "Profile" : "Dashboard"}
                </span>
                <span className="hidden md:inline">Operations Portal</span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400">
                <span className="md:hidden">Operations Portal</span>
                <span className="hidden md:inline">Enterprise Resource & Operations Management</span>
              </p>
            </div>
          </div>

          {/* GLOBAL TOP BAR SEARCH BAR */}
          <div className="hidden sm:block flex-1 max-w-xs md:max-w-md mx-2 sm:mx-4 relative" ref={searchRef}>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Search team, requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.trim()) setIsSearchOpen(true); }}
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2.5 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-inner"
              />
              {searchLoading && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[10px] text-slate-400">
                  ...
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
                          req.status === "Approved" || req.status === "Resolved" || req.status === "Completed" 
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

            {/* Mobile Search Results Dropdown (< sm) */}
            {mobileSearchOpen && isSearchOpen && (searchResults.team.length > 0 || searchResults.requests.length > 0) && (
              <div className="fixed inset-x-3 top-16 bg-[#14171f] rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-50 text-xs divide-y divide-white/5 max-h-[75vh] overflow-y-auto sm:hidden animate-in fade-in slide-in-from-top-2 duration-150">
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
                          req.status === "Approved" || req.status === "Resolved" || req.status === "Completed" 
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

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Search Toggle Button (< sm) */}
            <button
              onClick={() => {
                setMobileSearchOpen(!mobileSearchOpen);
                setIsNotifOpen(false);
                setDropdownOpen(false);
              }}
              className="sm:hidden p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition flex items-center justify-center cursor-pointer border border-white/10"
              title="Global Search"
              aria-label="Global Search"
            >
              <Search className="w-4 h-4" />
            </button>

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

              {/* Mobile backdrop for clean popover dismissal */}
              {isNotifOpen && (
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs sm:hidden z-40"
                  onClick={() => setIsNotifOpen(false)}
                />
              )}

              {isNotifOpen && (
                <div className="fixed inset-x-3 top-16 sm:top-auto sm:inset-x-auto sm:absolute sm:right-0 sm:mt-3 sm:w-96 max-w-sm sm:max-w-none mx-auto sm:mx-0 bg-[#14171f] rounded-2xl shadow-2xl border border-white/10 z-50 overflow-hidden text-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3.5 sm:p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded-full border border-rose-500/30">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => setIsConfirmClearNotifOpen(true)}
                        title="Clear all notifications"
                        aria-label="Clear all notifications"
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-white/5 rounded-lg flex items-center justify-center cursor-pointer transition"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto divide-y divide-white/5">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No notifications found.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3.5 transition text-left space-y-1.5 cursor-pointer ${
                            !notif.is_read
                              ? "bg-blue-950/30 border-l-4 border-rose-500 hover:bg-white/5 active:bg-white/10"
                              : "bg-transparent hover:bg-white/5 opacity-75"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-white flex items-center gap-1.5 leading-snug">
                              {!notif.is_read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>}
                              <span>{notif.title}</span>
                            </p>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              {new Date(notif.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
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
                  {profilePic && !imgError ? (
                    <img 
                      src={getMediaUrl(profilePic)} 
                      alt="Profile" 
                      className="w-full h-full object-cover" 
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-medium text-white">{userName}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{userRole}</p>
                </div>
                <NavArrowDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ml-1 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#14171f] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 text-slate-300 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-white/5 mb-1">
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
                    <Settings className="w-4 h-4 text-slate-400" />
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
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 pb-28 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0f12]/95 backdrop-blur-md border-t border-white/10 px-2 py-1.5 shadow-2xl safe-area-inset-bottom">
        <div className="w-full max-w-[720px] mx-auto flex items-center justify-around">
          {[
            { name: "Dashboard", path: "/dashboard", icon: <ViewGrid className="w-5 h-5" /> },
            { name: "Teams", path: "/members", icon: <Group className="w-5 h-5" /> },
            { name: "Resources", path: "/resources", icon: <Packages className="w-5 h-5" /> },
            { name: "Requests", path: "/requests", icon: <TaskList className="w-5 h-5" /> },
          ].map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                style={{ WebkitTapHighlightColor: "transparent" }}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer select-none active:bg-white/5 ${
                  isActive 
                    ? "text-white font-bold" 
                    : "text-slate-400 hover:text-slate-200 font-medium"
                }`}
              >
                <span className={`p-1 rounded-lg transition ${isActive ? "bg-white/10 text-white border border-white/10 shadow-xs" : ""}`}>
                  {tab.icon}
                </span>
                <span className="text-[11px] mt-0.5 tracking-tight font-semibold">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modern, Eye-Friendly In-App Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmClearNotifOpen}
        onClose={() => setIsConfirmClearNotifOpen(false)}
        onConfirm={executeClearNotifications}
        title="Clear Notifications"
        message="Are you sure you want to clear all your notifications? This cannot be undone."
        confirmText="Clear All"
        type="danger"
      />
    </div>
  );
}