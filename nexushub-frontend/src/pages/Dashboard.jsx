import React, { useState, useEffect } from "react";
import API from "../services/api";
import socket from "../services/socket";
import { DashboardSkeleton } from "../components/Skeletons";
import SinusoidalGraph from "../components/SinusoidalGraph";
import ConfirmationModal from "../components/ConfirmationModal";
import { getCachedData, setCachedData } from "../services/cache";
import { 
  Group, 
  Page, 
  Package, 
  Laptop, 
  Trash, 
  Activity, 
  CheckCircle, 
  Clock,
  StatsReport
} from "iconoir-react";

export default function Dashboard() {
  const cached = getCachedData("admin_dashboard");

  const [stats, setStats] = useState(
    cached?.stats || {
      totalMembers: 0,
      activeMembers: 0,
      totalRequests: 0,
      pendingRequests: 0,
      completedRequests: 0,
      totalResources: 0,
      requestsByStatus: { pending: 0, inProgress: 0, completed: 0 },
      resourcesByCategory: { laptops: 0, furniture: 0, equipment: 0, other: 0 },
    }
  );
  const [activities, setActivities] = useState(cached?.activities || []);
  const [loading, setLoading] = useState(!cached);
  const [clearing, setClearing] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

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
        setCachedData("admin_dashboard", {
          stats: response.data.stats || {},
          activities: recentActivities,
        });
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Real-time: re-fetch whenever any relevant data changes
    socket.on("dashboard_updated", fetchDashboardData);
    socket.on("requests_updated", fetchDashboardData);
    socket.on("members_updated", fetchDashboardData);
    socket.on("resources_updated", fetchDashboardData);

    return () => {
      socket.off("dashboard_updated", fetchDashboardData);
      socket.off("requests_updated", fetchDashboardData);
      socket.off("members_updated", fetchDashboardData);
      socket.off("resources_updated", fetchDashboardData);
    };
  }, []);

  const executeClearHistory = async () => {
    // Instant optimistic update: clear immediately and close modal
    setActivities([]);
    setIsConfirmClearOpen(false);
    setClearing(false);
    try {
      await API.delete("/dashboard/activities");
    } catch (err) {
      console.error("Failed to clear activity history:", err);
      fetchDashboardData();
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
    const bg = "bg-slate-100 border border-slate-200/60";

    if (type.includes("user") || desc.includes("user") || desc.includes("member")) {
      return { icon: <Group className="w-4 h-4 text-[#0F172A]" />, bg };
    }
    if (type.includes("request") || desc.includes("request")) {
      return { icon: <Page className="w-4 h-4 text-[#0F172A]" />, bg };
    }
    if (type.includes("resource") || desc.includes("resource") || desc.includes("equipment")) {
      return { icon: <Package className="w-4 h-4 text-[#0F172A]" />, bg };
    }
    if (desc.includes("laptop") || desc.includes("tech")) {
      return { icon: <Laptop className="w-4 h-4 text-[#0F172A]" />, bg };
    }
    if (desc.includes("delete") || desc.includes("remove")) {
      return { icon: <Trash className="w-4 h-4 text-[#0F172A]" />, bg };
    }
    if (desc.includes("complete") || desc.includes("resolve") || desc.includes("approved")) {
      return { icon: <CheckCircle className="w-4 h-4 text-[#0F172A]" />, bg };
    }
    
    return { icon: <Activity className="w-4 h-4 text-[#0F172A]" />, bg };
  };

  const requestWaveData = [
    { label: "Pending", shortLabel: "Pending", value: stats.requestsByStatus?.pending || 0 },
    { label: "In Progress", shortLabel: "In Prog", value: stats.requestsByStatus?.inProgress || 0 },
    { label: "Completed", shortLabel: "Done", value: stats.requestsByStatus?.completed || 0 },
  ];

  const resourceWaveData = [
    { label: "Laptops & Tech", shortLabel: "Laptops", value: stats.resourcesByCategory?.laptops || 0 },
    { label: "Office Equipment", shortLabel: "Equip", value: stats.resourcesByCategory?.equipment || 0 },
    { label: "Furniture", shortLabel: "Furn", value: stats.resourcesByCategory?.furniture || 0 },
    { label: "Other Assets", shortLabel: "Other", value: stats.resourcesByCategory?.other || 0 },
  ];

  if (loading) {
    return <DashboardSkeleton />;
  }

  const totalMembers = stats.totalMembers || 0;
  const activeMembers = stats.activeMembers || 0;
  const activeRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 100;

  const totalRequests = stats.totalRequests || 0;
  const completedRequests = stats.completedRequests || 0;
  const resolveRate = totalRequests > 0 ? ((completedRequests / totalRequests) * 100).toFixed(1) : "0.0";

  const totalResources = stats.totalResources || 0;

  return (
    <div className="text-[#0F172A] p-3 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-5 sm:space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-5 sm:px-6 py-4 sm:py-5 rounded-2xl text-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
            Operations Dashboard
          </h1>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Real-time snapshot of resources, team metrics, and work request tracking.
          </p>
        </div>

        <div className="flex items-center">
          <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-white border border-white/15 font-bold uppercase tracking-wider">
            Admin Portal
          </span>
        </div>
      </div>

      {/* Summary Cards Grid: 2 columns on mobile, 3 columns on tablet/desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
        {/* Card 1: Total Team */}
        <div className="bg-white border border-gray-100 p-3.5 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider truncate">
              Total Team
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 text-[#0F172A] rounded-xl flex items-center justify-center shrink-0">
              <Group className="w-4 h-4 sm:w-5 sm:h-5 text-[#0F172A]" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {totalMembers}
            </h3>
            <p className="text-[10px] sm:text-xs font-semibold text-[#0F172A] mt-1 truncate">
              {totalMembers} Members
            </p>
          </div>
        </div>

        {/* Card 2: Active Members */}
        <div className="bg-white border border-gray-100 p-3.5 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider truncate">
              Active Members
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 text-[#0F172A] rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#0F172A]" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {activeMembers}
            </h3>
            <p className="text-[10px] sm:text-xs font-semibold text-[#0F172A] mt-1 truncate">
              {activeRate}% active
            </p>
          </div>
        </div>

        {/* Card 3: Total Requests */}
        <div className="bg-white border border-gray-100 p-3.5 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider truncate">
              Total Requests
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 text-[#0F172A] rounded-xl flex items-center justify-center shrink-0">
              <Page className="w-4 h-4 sm:w-5 sm:h-5 text-[#0F172A]" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {totalRequests}
            </h3>
            <p className="text-[10px] sm:text-xs font-semibold text-[#0F172A] mt-1 truncate">
              Logged to date
            </p>
          </div>
        </div>

        {/* Card 4: Pending */}
        <div className="bg-white border border-gray-100 p-3.5 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider truncate">
              Pending
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 text-[#0F172A] rounded-xl flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#0F172A]" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {stats.pendingRequests}
            </h3>
            <p className="text-[10px] sm:text-xs font-semibold text-[#0F172A] mt-1 truncate">
              {stats.pendingRequests === 0 ? "All queues clear" : "Awaiting review"}
            </p>
          </div>
        </div>

        {/* Card 5: Completed */}
        <div className="bg-white border border-gray-100 p-3.5 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider truncate">
              Completed
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 text-[#0F172A] rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#0F172A]" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {completedRequests}
            </h3>
            <p className="text-[10px] sm:text-xs font-semibold text-[#0F172A] mt-1 truncate">
              {resolveRate}% resolve rate
            </p>
          </div>
        </div>

        {/* Card 6: Total Resources */}
        <div className="bg-white border border-gray-100 p-3.5 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider truncate">
              Total Resources
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 text-[#0F172A] rounded-xl flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-[#0F172A]" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {totalResources}
            </h3>
            <p className="text-[10px] sm:text-xs font-semibold text-[#0F172A] mt-1 truncate">
              Allocated hardware
            </p>
          </div>
        </div>
      </div>

      {/* Lower Section: Recent Activities & Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Recent Activities Feed */}
        <div className="lg:col-span-2 bg-white border border-gray-100 p-4 sm:p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">Recent Activity History (Last 24 Hours)</h3>
            {activities.length > 0 && (
              <button
                onClick={() => setIsConfirmClearOpen(true)}
                disabled={clearing}
                title="Clear History"
                aria-label="Clear History"
                className="p-1.5 text-rose-600 hover:text-rose-700 transition cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0 border-0 bg-transparent hover:bg-transparent"
              >
                <Trash className={`w-4 h-4 ${clearing ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>

          {activities.length === 0 ? (
            <p className="text-xs text-[#64748B] py-6 text-center font-medium">No activity recorded in the past 24 hours.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((act, index) => {
                const activityStyle = getActivityIcon(act);
                return (
                  <div key={act.id || index} className="flex items-start gap-3 sm:gap-3.5 p-3 sm:p-3.5 rounded-xl bg-[#F8FAFC] border border-gray-100 text-xs hover:border-slate-200 transition">
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${activityStyle.bg}`}>
                      {activityStyle.icon}
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#0F172A] truncate">
                          {act.entity_type ? `${act.entity_type} Log` : (act.action || 'System Action')}
                        </span>
                        <span className="text-[10px] text-[#64748B] flex items-center gap-1 shrink-0 font-medium">
                          <Clock className="w-3 h-3 text-[#64748B]" />
                          {formatDate(act.created_at)}
                        </span>
                      </div>
                      <p className="text-[#475569] font-medium leading-relaxed text-xs">
                        {act.description || act.action || 'Activity recorded'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Analytics Charts Sidebar */}
        <div className="flex flex-col space-y-4 sm:space-y-6">
          
          {/* Requests by Status Sinusoidal Graph Box */}
          <div className="bg-white border border-gray-100 p-4 sm:p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Requests by Status</h3>
                <p className="text-[10px] text-slate-400">Sinusoidal wave distribution</p>
              </div>
              <StatsReport className="w-4 h-4 text-[#0F172A]" />
            </div>
            
            <SinusoidalGraph
              data={requestWaveData}
              graphId="requests"
              height={130}
              width={320}
            />
          </div>

          {/* Resources by Category Sinusoidal Graph Box */}
          <div className="bg-white border border-gray-100 p-4 sm:p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Resources by Category</h3>
                <p className="text-[10px] text-slate-400">Sinusoidal inventory wave</p>
              </div>
              <Package className="w-4 h-4 text-[#0F172A]" />
            </div>

            <SinusoidalGraph
              data={resourceWaveData}
              graphId="resources"
              height={130}
              width={320}
            />
          </div>

        </div>
      </div>

      {/* Modern, Eye-Friendly Frontend Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        onConfirm={executeClearHistory}
        title="Clear Activity History"
        message="Are you sure you want to clear your activity history? This cannot be undone."
        confirmText="Clear History"
        type="danger"
        loading={clearing}
      />
    </div>
  );
}
