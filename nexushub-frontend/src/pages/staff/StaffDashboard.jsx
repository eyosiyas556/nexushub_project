import React, { useState, useEffect } from "react";
import API from "../../services/api";
import { Trash2 } from "lucide-react";

export default function StaffDashboard() {
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    completedRequests: 0,
    totalAssignedResources: 0,
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [assignedResources, setAssignedResources] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Clear History loading state for logs
  const [clearingLogs, setClearingLogs] = useState(false);

  // State to control the popup modal for assigned resources
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await API.get("/staff/dashboard");
      const result = response.data;
      if (result.success) {
        setStats(result.stats);
        setRecentRequests(result.recentRequests || []);
        setAssignedResources(result.assignedResources || []);
        setRecentLogs(result.recentLogs || []);
      }
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseResource = async (resourceCode) => {
    if (
      !window.confirm(
        `Are you sure you want to release resource ${resourceCode}? This will make it available again.`
      )
    )
      return;

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
      alert(err.response?.data?.error || "Failed to release resource.");
    }
  };

  const handleClearLogs = async () => {
    if (
      !window.confirm("Are you sure you want to clear your resource log history?")
    )
      return;
    setClearingLogs(true);
    try {
      const response = await API.delete("/staff/activities");
      if (response.data.success) {
        setRecentLogs([]);
      }
    } catch (err) {
      console.error("Failed to clear resource log history:", err);
      alert(err.response?.data?.error || "Failed to clear resource log history.");
    } finally {
      setClearingLogs(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[#64748B] font-medium animate-pulse">
        Loading staff dashboard...
      </div>
    );
  }

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
          <span className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
            Active Session
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Total Requests
            </p>
            <h3 className="text-2xl font-extrabold text-[#0F172A]">
              {stats.totalRequests}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shadow-inner">
            📋
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Pending Requests
            </p>
            <h3 className="text-2xl font-extrabold text-amber-600">
              {stats.pendingRequests}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg shadow-inner">
            ⏳
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Completed Tasks
            </p>
            <h3 className="text-2xl font-extrabold text-emerald-600">
              {stats.completedRequests}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-inner">
            ✅
          </div>
        </div>

        {/* CLICKABLE ASSIGNED RESOURCES CARD */}
        <div
          onClick={() => setIsModalOpen(true)}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition group"
        >
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider group-hover:text-blue-600 transition">
              Assigned Resources
            </p>
            <h3 className="text-2xl font-extrabold text-[#2563EB]">
              {stats.totalAssignedResources}
            </h3>
            <p className="text-[10px] text-blue-500 font-medium">
              Click to view items →
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center text-lg shadow-inner group-hover:scale-105 transition">
            📦
          </div>
        </div>
      </div>

      {/* Details Sections Grid (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Work Requests */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">
              Recent Work Requests
            </h2>
          </div>

          {recentRequests.length === 0 ? (
            <p className="text-xs text-[#64748B] py-6 text-center">
              No recent work requests found.
            </p>
          ) : (
            <div className="space-y-3">
              {recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl bg-[#F8FAFC] border border-gray-100 text-xs space-y-2 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A] text-sm">
                      {req.title || `Request #${req.id}`}
                    </span>
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                        req.status === "Completed" ||
                        req.status === "Resolved" ||
                        req.status === "Closed"
                          ? "bg-emerald-50 text-emerald-600"
                          : req.status === "Pending"
                          ? "bg-amber-50 text-amber-600"
                          : req.status === "Rejected"
                          ? "bg-red-50 text-red-600"
                          : "bg-blue-50 text-blue-600"
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
                    <span>
                      Priority:{" "}
                      <strong
                        className={`font-semibold ${req.priority === "High" || req.priority === "Urgent" ? "text-red-600" : "text-amber-600"}`}
                      >
                        {req.priority || "Medium"}
                      </strong>
                    </span>
                    <span>{new Date(req.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resource Log History */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">
              Resource Log History
            </h2>
            {recentLogs.length > 0 && (
              <button
                onClick={handleClearLogs}
                disabled={clearingLogs}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {clearingLogs ? "Clearing..." : "Clear Log History"}
              </button>
            )}
          </div>

          {recentLogs.length === 0 ? (
            <p className="text-xs text-[#64748B] py-6 text-center">
              No recent resource log history recorded.
            </p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-gray-100 text-xs"
                >
                  <span className="text-sm mt-0.5">📌</span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A]">
                        {log.entity_type
                          ? `${log.entity_type} Log`
                          : log.action || "System Action"}
                      </span>
                      <span className="text-[10px] text-[#64748B]">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#475569] font-medium leading-relaxed">
                      {log.description || log.action || "Activity recorded"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ASSIGNED RESOURCES MODAL POPUP */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📦</span>
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
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-blue-50 text-blue-600 border border-blue-100">
                        {res.status || "In Use"}
                      </span>
                      <button
                        onClick={() => handleReleaseResource(res.resource_code)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-semibold transition cursor-pointer"
                      >
                        Release
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
    </div>
  );
}