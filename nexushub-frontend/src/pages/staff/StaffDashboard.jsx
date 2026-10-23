import { StaffDashboardSkeleton } from "../../components/Skeletons";
import React, { useState, useEffect } from "react";
import API from "../../services/api";
import { Trash, Page, Clock, CheckCircle, Package, LogOut, StatsReport, Activity } from "iconoir-react";
import socket from "../../services/socket";
import SinusoidalGraph from "../../components/SinusoidalGraph";
import ConfirmationModal from "../../components/ConfirmationModal";
import { getCachedData, setCachedData } from "../../services/cache";

export default function StaffDashboard() {
  const cached = getCachedData("staff_dashboard");

  const [stats, setStats] = useState(
    cached?.stats || {
      totalRequests: 0,
      pendingRequests: 0,
      completedRequests: 0,
      totalAssignedResources: 0,
    }
  );
  const [recentRequests, setRecentRequests] = useState(cached?.recentRequests || []);
  const [assignedResources, setAssignedResources] = useState(cached?.assignedResources || []);
  const [recentLogs, setRecentLogs] = useState(cached?.recentLogs || []);
  const [loading, setLoading] = useState(!cached);

  // Clear History loading state for logs
  const [clearingLogs, setClearingLogs] = useState(false);

  // State to control the popup modal for assigned resources
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reusable frontend confirmation dialog state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    type: "default",
    onConfirm: () => {},
  });

  const fetchDashboardData = async () => {
    try {
      const response = await API.get("/staff/dashboard");
      const result = response.data;
      if (result.success) {
        setStats(result.stats);
        setRecentRequests(result.recentRequests || []);
        setAssignedResources(result.assignedResources || []);
        setRecentLogs(result.recentLogs || []);
        setCachedData("staff_dashboard", result);
      }
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Real-time: re-fetch whenever any relevant data changes
    socket.on("dashboard_updated", fetchDashboardData);
    socket.on("requests_updated", fetchDashboardData);
    socket.on("resources_updated", fetchDashboardData);
    socket.on("members_updated", fetchDashboardData);

    const handleSync = () => fetchDashboardData();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleSync();
    };
    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleVisibility);
    const syncInterval = setInterval(handleSync, 8000);

    return () => {
      socket.off("dashboard_updated", fetchDashboardData);
      socket.off("requests_updated", fetchDashboardData);
      socket.off("resources_updated", fetchDashboardData);
      socket.off("members_updated", fetchDashboardData);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(syncInterval);
    };
  }, []);

  const executeReleaseResource = async (resourceCode) => {
    try {
      const response = await API.put(
        `/staff/resources/${resourceCode}/release`
      );
      if (response.data.success) {
        setAssignedResources(
          assignedResources.filter((res) => res.resource_code !== resourceCode)
        );
        setStats((prev) => ({
          ...prev,
          totalAssignedResources: Math.max(0, prev.totalAssignedResources - 1),
        }));
      }
    } catch (err) {
      console.error("Failed to release resource:", err);
    } finally {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handlePromptRelease = (resourceCode) => {
    setConfirmModal({
      isOpen: true,
      title: "Release Resource",
      message: `Are you sure you want to release resource ${resourceCode}? It will be returned to the shared inventory.`,
      confirmText: "Release Resource",
      type: "release",
      onConfirm: () => executeReleaseResource(resourceCode),
    });
  };

  // View Mode for Activity History: "all" (Graph + Feed), "graph", or "feed"
  const [activityViewMode, setActivityViewMode] = useState("all");

  const executeClearLogs = async () => {
    // Instant optimistic update: clear immediately and close modal
    setRecentLogs([]);
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    setClearingLogs(false);
    try {
      await API.delete("/staff/activities");
    } catch (err) {
      console.error("Failed to clear activity history:", err);
      fetchDashboardData();
    }
  };

  const handlePromptClearLogs = () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear Activity History",
      message: "Are you sure you want to clear your activity history? This cannot be undone.",
      confirmText: "Clear History",
      type: "danger",
      onConfirm: executeClearLogs,
    });
  };

  if (loading) {
    return <StaffDashboardSkeleton />;
  }

  // Filter recent requests to only those created or updated within the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentRequests24h = recentRequests.filter((req) => {
    const time = new Date(req.updated_at || req.created_at).getTime();
    return !isNaN(time) && time >= twentyFourHoursAgo.getTime();
  });

  // Dynamic grid sizing: as activities increase or when 24h requests are few, broaden the activity history section
  let requestsColSpan = "lg:col-span-6";
  let logsColSpan = "lg:col-span-6";

  if (recentRequests24h.length === 0 && recentLogs.length > 0) {
    requestsColSpan = "lg:col-span-4";
    logsColSpan = "lg:col-span-8";
  } else if (recentLogs.length >= 3 && recentRequests24h.length <= 2) {
    requestsColSpan = "lg:col-span-5";
    logsColSpan = "lg:col-span-7";
  } else if (recentLogs.length === 0 && recentRequests24h.length > 0) {
    requestsColSpan = "lg:col-span-8";
    logsColSpan = "lg:col-span-4";
  }

  const isBroadLogs = logsColSpan === "lg:col-span-8" || logsColSpan === "lg:col-span-7";

  // Activity wave data for the modern graph
  const now = Date.now();
  const timeIntervals = [
    { label: "24h ago", shortLabel: "24h", minAge: 18 * 3600000, maxAge: 24 * 3600000 },
    { label: "18h ago", shortLabel: "18h", minAge: 12 * 3600000, maxAge: 18 * 3600000 },
    { label: "12h ago", shortLabel: "12h", minAge: 6 * 3600000, maxAge: 12 * 3600000 },
    { label: "6h ago", shortLabel: "6h", minAge: 2 * 3600000, maxAge: 6 * 3600000 },
    { label: "1h ago", shortLabel: "1h", minAge: 0.25 * 3600000, maxAge: 2 * 3600000 },
    { label: "Just now", shortLabel: "Now", minAge: 0, maxAge: 0.25 * 3600000 },
  ];

  const timeWave = timeIntervals.map((interval) => {
    const count = recentLogs.filter((log) => {
      const logTime = new Date(log.created_at).getTime();
      const age = now - logTime;
      return age >= interval.minAge && age < interval.maxAge;
    }).length;
    return {
      label: interval.label,
      shortLabel: interval.shortLabel,
      value: count,
    };
  });

  const hasTimeDistribution = timeWave.some((d) => d.value > 0);

  const activityWaveData = hasTimeDistribution
    ? timeWave
    : [
        { label: "Work Requests", shortLabel: "Requests", value: recentLogs.filter(l => ((l.entity_type || "") + (l.description || "")).toLowerCase().includes("request")).length },
        { label: "Resources", shortLabel: "Resources", value: recentLogs.filter(l => ((l.entity_type || "") + (l.description || "")).toLowerCase().includes("resource")).length },
        { label: "Releases", shortLabel: "Releases", value: recentLogs.filter(l => ((l.action || "") + (l.description || "")).toLowerCase().includes("release")).length },
        { label: "System Actions", shortLabel: "System", value: recentLogs.filter(l => !((l.entity_type || "") + (l.description || "")).toLowerCase().includes("request") && !((l.entity_type || "") + (l.description || "")).toLowerCase().includes("resource")).length || recentLogs.length },
      ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 text-[#0F172A]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-6 py-5 rounded-2xl text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm relative">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
            Staff Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Overview of your assigned tasks, work requests, and system activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] px-3 py-1.5 rounded-full bg-white/10 text-white border border-white/15 font-semibold">
            Active Session
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider">
              Total Requests
            </p>
            <h3 className="text-2xl font-extrabold text-[#0F172A]">
              {stats.totalRequests}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#0F172A] flex items-center justify-center shadow-inner">
            <Page className="w-6 h-6 text-[#0F172A]" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider">
              Pending Requests
            </p>
            <h3 className="text-2xl font-extrabold text-[#0F172A]">
              {stats.pendingRequests}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#0F172A] flex items-center justify-center shadow-inner">
            <Clock className="w-6 h-6 text-[#0F172A]" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider">
              Completed Tasks
            </p>
            <h3 className="text-2xl font-extrabold text-[#0F172A]">
              {stats.completedRequests}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#0F172A] flex items-center justify-center shadow-inner">
            <CheckCircle className="w-6 h-6 text-[#0F172A]" />
          </div>
        </div>

        {/* CLICKABLE ASSIGNED RESOURCES CARD */}
        <div
          onClick={() => setIsModalOpen(true)}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-400 hover:shadow-md transition group"
        >
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider transition">
              Assigned Resources
            </p>
            <h3 className="text-2xl font-extrabold text-[#0F172A]">
              {stats.totalAssignedResources}
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Click to view items →
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#0F172A] flex items-center justify-center shadow-inner group-hover:scale-105 transition">
            <Package className="w-6 h-6 text-[#0F172A]" />
          </div>
        </div>
      </div>

      {/* Details Sections Grid (Dynamic & Content-Fitting to Remove Blank White Space) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Work Requests (Filtered to Last 24 Hours) */}
        <div className={`${requestsColSpan} bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 h-fit transition-all duration-300`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">
                Recent Work Requests
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">Last 24 hours</p>
            </div>
            <span className="text-[10px] font-bold text-[#0F172A] bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {recentRequests24h.length}
            </span>
          </div>

          {recentRequests24h.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#64748B] space-y-1">
              <p className="font-semibold text-slate-700">No requests in the past 24 hours</p>
              <p className="text-[11px] text-slate-400">Any submissions or status updates in the last 24 hours will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRequests24h.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl bg-[#F8FAFC] border border-gray-100 text-xs space-y-2 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A] text-sm">
                      {req.title || `Request #${req.id}`}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                        req.status === "Approved" ||
                        req.status === "Completed" ||
                        req.status === "Resolved" ||
                        req.status === "Closed"
                          ? "text-[#137333]"
                          : req.status === "In Progress"
                          ? "text-[#1A73E8]"
                          : req.status === "Rejected"
                          ? "text-[#C5221F]"
                          : "text-[#B06000]"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475569] line-clamp-1">
                    {req.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-1.5 border-t border-gray-200/60">
                    <span>
                      Category:{" "}
                      <strong className="text-[#0F172A]">
                        {req.category || "General"}
                      </strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      Priority:{" "}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                          req.priority === "Urgent"
                            ? "text-[#C5221F]"
                            : req.priority === "High"
                            ? "text-[#B06000]"
                            : req.priority === "Medium"
                            ? "text-[#1A73E8]"
                            : "text-[#5F6368]"
                        }`}
                      >
                        {req.priority || "Medium"}
                      </span>
                    </span>
                    <span>
                      {new Date(req.created_at).toLocaleDateString([], { month: "short", day: "numeric" })} · {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity History (Dynamic & Expressed by Modern Graph) */}
        <div className={`${logsColSpan} bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 h-fit transition-all duration-300`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#0F172A]">
                  Activity History
                </h2>
                <span className="text-[10px] font-bold text-[#0F172A] bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {recentLogs.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Modern analytics wave &amp; operational activity feed
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {recentLogs.length > 0 && (
                <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200/80 text-[10px] font-semibold text-[#0F172A]">
                  <button
                    type="button"
                    onClick={() => setActivityViewMode("all")}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      activityViewMode === "all"
                        ? "bg-white text-[#0F172A] shadow-xs font-bold"
                        : "text-slate-500 hover:text-[#0F172A]"
                    }`}
                  >
                    Both
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityViewMode("graph")}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      activityViewMode === "graph"
                        ? "bg-white text-[#0F172A] shadow-xs font-bold"
                        : "text-slate-500 hover:text-[#0F172A]"
                    }`}
                  >
                    <StatsReport className="w-3 h-3" />
                    <span>Graph</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityViewMode("feed")}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      activityViewMode === "feed"
                        ? "bg-white text-[#0F172A] shadow-xs font-bold"
                        : "text-slate-500 hover:text-[#0F172A]"
                    }`}
                  >
                    Feed
                  </button>
                </div>
              )}

              {recentLogs.length > 0 && (
                <button
                  onClick={handlePromptClearLogs}
                  disabled={clearingLogs}
                  title="Clear Activity History"
                  aria-label="Clear Activity History"
                  className="p-1.5 text-rose-600 hover:text-rose-700 transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center border-0 bg-transparent"
                >
                  <Trash className="w-4 h-4 text-rose-600" />
                </button>
              )}
            </div>
          </div>

          {recentLogs.length === 0 ? (
            <p className="text-xs text-[#64748B] py-8 text-center">
              No recent activity history recorded.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Modern Sinusoidal Graph Expressing Activity History */}
              {(activityViewMode === "all" || activityViewMode === "graph") && (
                <div className="bg-[#F8FAFC] border border-gray-100 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">
                        Activity Pulse Wave
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {hasTimeDistribution ? "Dynamic timeline wave (last 24h)" : "Activity category distribution"}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-gray-200">
                      Sinusoidal Curve
                    </span>
                  </div>
                  <SinusoidalGraph
                    data={activityWaveData}
                    graphId="staff-activity-wave"
                    height={130}
                    width={isBroadLogs ? 520 : 360}
                    emptyLabel="No activity data to plot"
                  />
                </div>
              )}

              {/* Feed items */}
              {(activityViewMode === "all" || activityViewMode === "feed") && (
                <div className={`grid gap-3 ${isBroadLogs ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-gray-100 text-xs hover:bg-slate-50 transition"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-[#0F172A] shrink-0 mt-0.5">
                        <Clock className="w-4 h-4 text-[#0F172A]" />
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#0F172A] truncate">
                            {log.entity_type
                              ? `${log.entity_type} Log`
                              : log.action || "System Action"}
                          </span>
                          <span className="text-[10px] text-[#64748B] shrink-0">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-[#475569] font-medium leading-relaxed line-clamp-2">
                          {log.description || log.action || "Activity recorded"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ASSIGNED RESOURCES MODAL POPUP */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[#0F172A] border border-slate-200/60 shrink-0">
                  <Package className="w-4 h-4 text-[#0F172A]" />
                </div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  Your Assigned Resources
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {assignedResources.length === 0 ? (
              <p className="text-xs text-[#64748B] py-8 text-center">
                No resources currently assigned to you.
              </p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {assignedResources.map((res, index) => (
                  <div
                    key={res.id || index}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8FAFC] border border-gray-100 text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-[#0F172A] text-sm">
                        {res.name ||
                          res.title ||
                          `Resource ${res.resource_code}`}
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        Code:{" "}
                        <span className="font-mono font-bold text-blue-600">
                          {res.resource_code}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-[#F8FAFC] border border-slate-200/80 text-[#1A73E8]">
                        {res.status || "In Use"}
                      </span>
                      <button
                        onClick={() => handlePromptRelease(res.resource_code)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs cursor-pointer active:scale-95"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Release</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern, Eye-Friendly Frontend Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        loading={clearingLogs}
      />
    </div>
  );
}