import { TablePageSkeleton } from "../../components/Skeletons";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../../services/api";
import socket from "../../services/socket";
import { Eye } from "iconoir-react";
import ActionMenu from "../../components/ActionMenu";
import { getCachedData, setCachedData } from "../../services/cache";

export default function StaffResources() {
  const cached = getCachedData("staff_resources");
  const initialResources = Array.isArray(cached)
    ? cached
    : Array.isArray(cached?.resources)
    ? cached.resources
    : [];

  const [resources, setResources] = useState(initialResources);
  const [loading, setLoading] = useState(initialResources.length === 0);
  const [currentUserName, setCurrentUserName] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal state (View Only)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);

  const categoryOptions = [
    "Laptop",
    "Desktop",
    "Printer",
    "Meeting Room",
    "Vehicle",
    "Projector",
    "Furniture",
    "Other",
  ];

  const statusOptions = ["Available", "In Use", "Maintenance", "Retired"];

  // Highlight parameter from notification click
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightParam = searchParams.get("highlight");
  const [activeHighlight, setActiveHighlight] = useState(null);

  useEffect(() => {
    if (highlightParam) {
      setActiveHighlight(highlightParam);
      // Clear filters so the targeted resource is definitely rendered in the table
      setSearchQuery("");
      setCategoryFilter("");
      setStatusFilter("");

      const timer = setTimeout(() => {
        const lowerKey = highlightParam.toLowerCase();
        let targetEl =
          document.getElementById(`row-${highlightParam}`) ||
          document.querySelector(`[data-resource-code="${highlightParam}" i]`) ||
          document.querySelector(`[data-resource-code="${highlightParam}"]`);

        if (!targetEl) {
          const rows = document.querySelectorAll("tr[data-resource-code]");
          for (const r of rows) {
            if ((r.getAttribute("data-resource-code") || "").toLowerCase() === lowerKey) {
              targetEl = r;
              break;
            }
          }
        }

        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);

      const clearTimer = setTimeout(() => {
        setActiveHighlight(null);
        setSearchParams({}, { replace: true });
      }, 5000);

      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [highlightParam, resources, setSearchParams]);

  const fetchResources = async () => {
    try {
      const response = await API.get("/staff/resources");
      const list = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.resources)
        ? response.data.resources
        : [];

      setResources(list);
      setCachedData("staff_resources", list);
    } catch (err) {
      console.error("Failed to load staff resources:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.name) setCurrentUserName(u.name);
      }
    } catch (e) {
      console.error("Could not parse user from localStorage", e);
    }

    fetchResources();

    // Real-time updates via Socket
    socket.on("resources_updated", fetchResources);
    socket.on("requests_updated", fetchResources);

    // Resilient fallback sync: auto-refresh on tab focus & interval
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchResources();
    };
    window.addEventListener("focus", fetchResources);
    document.addEventListener("visibilitychange", handleVisibility);
    const syncInterval = setInterval(fetchResources, 8000);

    return () => {
      socket.off("resources_updated", fetchResources);
      socket.off("requests_updated", fetchResources);
      window.removeEventListener("focus", fetchResources);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(syncInterval);
    };
  }, []);

  const openViewModal = (res) => {
    setSelectedResource(res);
    setIsViewModalOpen(true);
  };

  const safeResources = Array.isArray(resources)
    ? resources
    : Array.isArray(resources?.resources)
    ? resources.resources
    : [];

  const filteredResources = safeResources.filter((res) => {
    if (!res) return false;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      (res.resource_code || "").toLowerCase().includes(query) ||
      (res.name || "").toLowerCase().includes(query);

    const matchesCategory = categoryFilter
      ? (res.category || "").toLowerCase() === categoryFilter.toLowerCase()
      : true;

    const matchesStatus = statusFilter
      ? (res.status || "").toLowerCase() === statusFilter.toLowerCase()
      : true;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
            Staff Resources
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Browse company assets and view live allocation details.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <TablePageSkeleton columnCount={5} rowCount={8} />
      ) : (
        <div className="space-y-4">
          {/* Controls: Search and Filters */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">
                Search Resources
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code or name..."
                className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] placeholder-gray-400 focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">
                Filter by Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
              >
                <option value="">All Categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
              >
                <option value="">All Statuses</option>
                {statusOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resources Table */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-h-[280px]">
              <table className="w-full text-left border-collapse table-fixed min-w-[750px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#F8FAFC]/80 text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">
                    <th className="py-4 px-5 w-[20%] font-bold text-[#0F172A]">Resource Code</th>
                    <th className="py-4 px-5 w-[26%] font-bold text-[#0F172A]">Resource Name</th>
                    <th className="py-4 px-5 w-[18%] font-bold text-[#0F172A]">Category</th>
                    <th className="py-4 px-5 w-[24%] font-bold text-[#0F172A]">Status & Holder</th>
                    <th className="py-4 px-5 w-[12%] text-right font-bold text-[#0F172A]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {filteredResources.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-[#64748B]">
                        No resources found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredResources.map((res) => {
                      const isInUse = res.status?.toLowerCase() === "in use";
                      const isAssignedToMe =
                        isInUse &&
                        currentUserName &&
                        res.current_user_name?.toLowerCase().trim() ===
                          currentUserName.toLowerCase().trim();

                      const isHighlighted =
                        activeHighlight &&
                        (String(res.resource_code || "").toLowerCase() === activeHighlight.toLowerCase() ||
                          String(res.id) === String(activeHighlight));

                      return (
                        <tr
                          key={res.id}
                          id={`row-${res.resource_code || res.id}`}
                          data-resource-code={res.resource_code}
                          className={`transition-all duration-700 ${
                            isHighlighted
                              ? "bg-[#F3F4F6]"
                              : "hover:bg-[#F8FAFC]/55"
                          }`}
                        >
                          <td className="py-3.5 px-5 font-mono font-medium text-[#0F172A] truncate">
                            {res.resource_code}
                          </td>
                          <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                            {res.name}
                          </td>
                          <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                            {res.category}
                          </td>
                          <td className="py-3.5 px-5 space-y-1">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                                res.status === "Available"
                                  ? "text-[#137333]"
                                  : isInUse
                                  ? "text-[#1A73E8]"
                                  : res.status === "Maintenance"
                                  ? "text-[#B06000]"
                                  : "text-[#5F6368]"
                              }`}
                            >
                              {res.status}
                            </span>
                            {isInUse && res.current_user_name && (
                              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 truncate">
                                <span>👤 Used by: <strong className="text-[#0F172A] font-medium">{res.current_user_name}</strong></span>
                                {isAssignedToMe && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[#0F172A] text-[10px] font-bold border border-slate-200">
                                    You
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <ActionMenu
                              actions={[
                                {
                                  label: "View Details",
                                  icon: <Eye className="w-4 h-4 text-slate-500" />,
                                  onClick: () => openViewModal(res),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && selectedResource && (() => {
        const isInUse = selectedResource.status?.toLowerCase() === "in use";

        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-[#0F172A]">Resource Details</h3>
              <div className="space-y-2 text-xs">
                <p>
                  <strong className="text-[#64748B]">Resource Code:</strong>{" "}
                  {selectedResource.resource_code}
                </p>
                <p>
                  <strong className="text-[#64748B]">Name:</strong>{" "}
                  {selectedResource.name}
                </p>
                <p>
                  <strong className="text-[#64748B]">Category:</strong>{" "}
                  {selectedResource.category}
                </p>
                <div className="flex items-center gap-2">
                  <strong className="text-[#64748B]">Status:</strong>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                      selectedResource.status === "Available"
                        ? "text-[#137333]"
                        : isInUse
                        ? "text-[#1A73E8]"
                        : selectedResource.status === "Maintenance"
                        ? "text-[#B06000]"
                        : "text-[#5F6368]"
                    }`}
                  >
                    {selectedResource.status}
                  </span>
                </div>
                {isInUse && selectedResource.current_user_name && (
                  <p className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                    <strong className="font-bold">Currently Used By:</strong> {selectedResource.current_user_name}
                  </p>
                )}
                <p>
                  <strong className="text-[#64748B]">Details:</strong>{" "}
                  {selectedResource.details || "No details provided."}
                </p>
              </div>
              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
