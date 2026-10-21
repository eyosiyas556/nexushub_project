import { TablePageSkeleton } from "../../components/Skeletons";
import React, { useState, useEffect } from "react";
import API from "../../services/api";
import socket from "../../services/socket";
import { Eye, LogOut } from "iconoir-react";
import ConfirmationModal from "../../components/ConfirmationModal";
import { getCachedData, setCachedData } from "../../services/cache";

export default function StaffResources() {
  const cached = getCachedData("staff_resources");
  const [resources, setResources] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [releasingCode, setReleasingCode] = useState(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [confirmReleaseCode, setConfirmReleaseCode] = useState(null);

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

  const loadCurrentUserInfo = () => {
    try {
      // Retrieve stored user object from login session
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const userObj = JSON.parse(userStr);
        setCurrentUserName(userObj.name || "");
      }
    } catch (err) {
      console.error("Failed to load current user info:", err);
    }
  };

  const fetchResources = async () => {
    try {
      const response = await API.get("/staff/resources");
      const data = response.data.resources || response.data || [];
      setResources(data);
      setCachedData("staff_resources", data);
    } catch (err) {
      console.error("Failed to fetch resources:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
    loadCurrentUserInfo();

    // Real-time: re-fetch whenever resources or requests data changes
    socket.on("resources_updated", fetchResources);
    socket.on("requests_updated", fetchResources);

    return () => {
      socket.off("resources_updated", fetchResources);
      socket.off("requests_updated", fetchResources);
    };
  }, []);

  const handleConfirmRelease = async () => {
    if (!confirmReleaseCode) return;
    const resourceCode = confirmReleaseCode;

    setReleasingCode(resourceCode);
    try {
      const response = await API.put(`/staff/resources/${resourceCode}/release`);
      if (response.data.success) {
        fetchResources();
        setIsViewModalOpen(false);
      }
    } catch (err) {
      console.error("Failed to release resource:", err);
    } finally {
      setReleasingCode(null);
      setConfirmReleaseCode(null);
    }
  };

  const openViewModal = (res) => {
    setSelectedResource(res);
    setIsViewModalOpen(true);
  };

  const filteredResources = resources.filter((res) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      res.resource_code?.toLowerCase().includes(query) ||
      res.name?.toLowerCase().includes(query);

    const matchesCategory = categoryFilter ? res.category === categoryFilter : true;
    const matchesStatus = statusFilter ? res.status === statusFilter : true;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (loading) {
    return <TablePageSkeleton titleWidth="w-72" hasCreateButton={false} />;
  }

  return (
    <div className="text-[#0F172A] p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Resources Catalog & Management
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Browse available company assets or release items currently assigned to you.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">
              Search Resources
            </label>
            <input
              type="text"
              placeholder="Search by Resource Code or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8FAFC]/80 text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Resource Code</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Resource Name</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Category</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Status & Holder</th>
                  <th className="py-4 px-6 text-right w-36 font-bold text-[#0F172A]">Actions</th>
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

                    return (
                      <tr key={res.id} className="hover:bg-[#F8FAFC]/55 transition">
                        <td className="py-4 px-6 font-mono font-medium text-[#0F172A]">
                          {res.resource_code}
                        </td>
                        <td className="py-4 px-6 font-medium text-[#0F172A]">
                          {res.name}
                        </td>
                        <td className="py-4 px-6 font-medium text-[#0F172A]">
                          {res.category}
                        </td>
                        <td className="py-4 px-6 space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              res.status === "Available"
                                ? "bg-[#E6F4EA] text-[#137333]"
                                : isInUse
                                ? "bg-[#E8F0FE] text-[#1A73E8]"
                                : res.status === "Maintenance"
                                ? "bg-[#FEF7E0] text-[#B06000]"
                                : "bg-[#F1F3F4] text-[#5F6368]"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                res.status === "Available"
                                  ? "bg-[#137333]"
                                  : isInUse
                                  ? "bg-[#1A73E8]"
                                  : res.status === "Maintenance"
                                  ? "bg-[#B06000]"
                                  : "bg-[#5F6368]"
                              }`}
                            />
                            {res.status}
                          </span>
                          {isInUse && res.current_user_name && (
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                              <span>👤 Used by: <strong className="text-[#0F172A] font-medium">{res.current_user_name}</strong></span>
                              {isAssignedToMe && (
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[#0F172A] text-[10px] font-bold border border-slate-200">
                                  You
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Show Release button ONLY if the resource is in use AND assigned to this specific staff member */}
                            {isAssignedToMe && (
                              <button
                                onClick={() => setConfirmReleaseCode(res.resource_code)}
                                disabled={releasingCode === res.resource_code}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>{releasingCode === res.resource_code ? "Releasing..." : "Release"}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openViewModal(res)}
                              title="View resource details"
                              aria-label="View resource"
                              className="p-1 text-slate-500 hover:text-[#0F172A] transition cursor-pointer inline-flex items-center justify-center"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* View Details Modal */}
      {isViewModalOpen && selectedResource && (() => {
        const isInUse = selectedResource.status?.toLowerCase() === "in use";
        const isAssignedToMe =
          isInUse &&
          currentUserName &&
          selectedResource.current_user_name?.toLowerCase().trim() ===
            currentUserName.toLowerCase().trim();

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
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedResource.status === "Available"
                        ? "bg-[#E6F4EA] text-[#137333]"
                        : isInUse
                        ? "bg-[#E8F0FE] text-[#1A73E8]"
                        : selectedResource.status === "Maintenance"
                        ? "bg-[#FEF7E0] text-[#B06000]"
                        : "bg-[#F1F3F4] text-[#5F6368]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        selectedResource.status === "Available"
                          ? "bg-[#137333]"
                          : isInUse
                          ? "bg-[#1A73E8]"
                          : selectedResource.status === "Maintenance"
                          ? "bg-[#B06000]"
                          : "bg-[#5F6368]"
                      }`}
                    />
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
              <div className="flex items-center justify-between pt-2">
                {isAssignedToMe ? (
                  <button
                    onClick={() => setConfirmReleaseCode(selectedResource.resource_code)}
                    disabled={releasingCode === selectedResource.resource_code}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl transition cursor-pointer disabled:opacity-50 shadow-xs active:scale-95"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{releasingCode === selectedResource.resource_code ? "Releasing..." : "Release Resource"}</span>
                  </button>
                ) : (
                  <div></div>
                )}
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

      {/* Modern, Eye-Friendly In-App Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(confirmReleaseCode)}
        onClose={() => setConfirmReleaseCode(null)}
        onConfirm={handleConfirmRelease}
        title="Release Resource"
        message={`Are you sure you want to release resource ${confirmReleaseCode}? It will be returned to the shared inventory.`}
        confirmText="Release Resource"
        type="release"
        loading={Boolean(releasingCode)}
      />
    </div>
  );
}