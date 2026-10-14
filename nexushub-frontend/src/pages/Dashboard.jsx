import React, { useState, useEffect } from "react";
import API from "../services/api";
import { 
  Users, 
  FileText, 
  Package, 
  Laptop, 
  Trash2, 
  Activity, 
  CheckCircle, 
  Clock,
  BarChart3
} from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalRequests: 0,
    pendingRequests: 0,
    completedRequests: 0,
    totalResources: 0,
    requestsByStatus: { pending: 0, inProgress: 0, completed: 0 },
    resourcesByCategory: { laptops: 0, furniture: 0, equipment: 0, other: 0 },
  });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const response = await API.get("/dashboard/summary");
      if (response.data.success) {
        setStats(response.data.stats || {});
        
        const rawActivities = response.data.activities || [];
        const twentyFourHoursAgo = new Date().getTime() - (24 * 60 * 60 * 1000);
        
        const recentActivities = rawActivities.filter(act => {
          const rawDate = act.created_at || act.timestamp;
          if (!rawDate) return false;
          const actTime = new Date(rawDate).getTime();
          return !isNaN(actTime) && actTime >= twentyFourHoursAgo;
        });

        setActivities(recentActivities);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all recent activity logs?")) return;

    setClearing(true);
    try {
      const response = await API.delete("/dashboard/activities");
      if (response.data.success) {
        setActivities([]);
      }
    } catch (err) {
      console.error("Failed to clear activity history:", err);
      alert(err.response?.data?.error || "Failed to clear activity history.");
    } finally {
      setClearing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Just now";
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? "Just now" : d.toLocaleString();
  };

  const getActivityIcon = (act) => {
    const type = (act.entity_type || act.type || "").toLowerCase();
    const desc = (act.description || act.action || "").toLowerCase();

    if (type.includes("user") || desc.includes("user") || desc.includes("member")) {
      return { icon: <Users className="w-4 h-4 text-blue-600" />, bg: "bg-blue-50 border border-blue-100" };
    }
    if (type.includes("request") || desc.includes("request")) {
      return { icon: <FileText className="w-4 h-4 text-amber-600" />, bg: "bg-amber-50 border border-amber-100" };
    }
    if (type.includes("resource") || desc.includes("resource") || desc.includes("equipment")) {
      return { icon: <Package className="w-4 h-4 text-purple-600" />, bg: "bg-purple-50 border border-purple-100" };
    }
    if (desc.includes("laptop") || desc.includes("tech")) {
      return { icon: <Laptop className="w-4 h-4 text-indigo-600" />, bg: "bg-indigo-50 border border-indigo-100" };
    }
    if (desc.includes("delete") || desc.includes("remove")) {
      return { icon: <Trash2 className="w-4 h-4 text-rose-600" />, bg: "bg-rose-50 border border-rose-100" };
    }
    if (desc.includes("complete") || desc.includes("resolve") || desc.includes("approved")) {
      return { icon: <CheckCircle className="w-4 h-4 text-emerald-600" />, bg: "bg-emerald-50 border border-emerald-100" };
    }
    
    return { icon: <Activity className="w-4 h-4 text-slate-600" />, bg: "bg-slate-50 border border-slate-100" };
  };

  const totalReqsForChart = Math.max(stats.totalRequests, 1);
  const pendingPercent = Math.round(((stats.requestsByStatus?.pending || 0) / totalReqsForChart) * 100);
  const inProgressPercent = Math.round(((stats.requestsByStatus?.inProgress || 0) / totalReqsForChart) * 100);
  const completedPercent = Math.round(((stats.requestsByStatus?.completed || 0) / totalReqsForChart) * 100);

  const totalResForChart = Math.max(stats.totalResources, 1);
  const laptopsPercent = Math.round(((stats.resourcesByCategory?.laptops || 0) / totalResForChart) * 100);
  const equipmentPercent = Math.round(((stats.resourcesByCategory?.equipment || 0) / totalResForChart) * 100);
  const furniturePercent = Math.round(((stats.resourcesByCategory?.furniture || 0) / totalResForChart) * 100);

  if (loading) {
    return (
      <div className="h-full bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        <p className="text-sm font-medium animate-pulse">Loading operations snapshot...</p>
      </div>
    );
  }

  return (
    <div className="text-[#0F172A] p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-6 py-5 rounded-2xl text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm relative">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
            Operations Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Real-time snapshot of resources, team metrics, and work request tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
            Admin Portal
          </span>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Total Team Members</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-2">{stats.totalMembers}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Active Members</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#16A34A] mt-2">{stats.activeMembers}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Total Work Requests</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-2">{stats.totalRequests}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold shrink-0">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Pending Requests</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#F59E0B] mt-2">{stats.pendingRequests}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Completed Requests</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#16A34A] mt-2">{stats.completedRequests}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Total Resources</p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-2">{stats.totalResources}</h3>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold shrink-0">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Lower Section: Recent Activities & Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Recent Activities Feed */}
        <div className="lg:col-span-2 bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">Recent Activity History (Last 24 Hours)</h3>
            {activities.length > 0 && (
              <button
                onClick={handleClearHistory}
                disabled={clearing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {clearing ? "Clearing..." : "Clear History"}
              </button>
            )}
          </div>

          {activities.length === 0 ? (
            <p className="text-xs text-[#64748B] py-6 text-center">No activity recorded in the past 24 hours.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((act, index) => {
                const activityStyle = getActivityIcon(act);
                return (
                  <div key={act.id || index} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#F8FAFC] border border-gray-100 text-xs">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${activityStyle.bg}`}>
                      {activityStyle.icon}
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F172A]">{act.entity_type ? `${act.entity_type} Log` : (act.action || 'System Action')}</span>
                        <span className="text-[10px] text-[#64748B]">{formatDate(act.created_at)}</span>
                      </div>
                      <p className="text-[#475569] font-medium leading-relaxed">{act.description || act.action || 'Activity recorded'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Analytics Charts Sidebar */}
        <div className="flex flex-col space-y-4">
          
          {/* Requests by Status Chart Box */}
          <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[#0F172A]">Requests by Status</h3>
              <BarChart3 className="w-4 h-4 text-slate-400" />
            </div>
            
            <div className="space-y-2">
              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#64748B] flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending
                  </span>
                  <span className="font-bold text-[#0F172A]">{stats.requestsByStatus?.pending || 0}</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${pendingPercent}%` }}></div>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#64748B] flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> In Progress
                  </span>
                  <span className="font-bold text-[#0F172A]">{stats.requestsByStatus?.inProgress || 0}</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${inProgressPercent}%` }}></div>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#64748B] flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Completed
                  </span>
                  <span className="font-bold text-[#0F172A]">{stats.requestsByStatus?.completed || 0}</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${completedPercent}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Resources by Category Chart Box */}
          <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[#0F172A]">Resources by Category</h3>
              <Package className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-2">
              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#64748B] font-medium">Laptops & Tech</span>
                  <span className="font-bold text-[#0F172A]">{stats.resourcesByCategory?.laptops || 0}</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${laptopsPercent}%` }}></div>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#64748B] font-medium">Office Equipment</span>
                  <span className="font-bold text-[#0F172A]">{stats.resourcesByCategory?.equipment || 0}</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${equipmentPercent}%` }}></div>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#64748B] font-medium">Furniture & Assets</span>
                  <span className="font-bold text-[#0F172A]">{stats.resourcesByCategory?.furniture || 0}</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-teal-600 h-full rounded-full transition-all duration-500" style={{ width: `${furniturePercent}%` }}></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}