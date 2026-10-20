import React, { useState, useEffect } from "react";
import API from "../../services/api";
import socket from "../../services/socket";

export default function StaffResources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [releasingCode, setReleasingCode] = useState(null);
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
      setResources(response.data.resources || response.data || []);
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

  const handleReleaseResource = async (resourceCode) => {
    if (
      !window.confirm(
        `Are you sure you want to release resource ${resourceCode}? This will return it to available inventory.`
      )
    )
      return;

    setReleasingCode(resourceCode);
    try {
      const response = await API.put(`/staff/resources/${resourceCode}/release`);
      if (response.data.success) {
        fetchResources();
        setIsViewModalOpen(false);
      }
    } catch (err) {
      console.error("Failed to release resource:", err);
      alert(err.response?.data?.error || "Failed to release resource.");
    } finally {
      setReleasingCode(null);
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
    return (
      <div className="h-full bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        <p className="text-sm font-medium animate-pulse">Loading resources...</p>
      </div>
    );
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
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
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
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
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
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
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
                <tr className="border-b border-gray-100 bg-[#F8FAFC]/50 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="py-4 px-6">Resource Code</th>
                  <th className="py-4 px-6">Resource Name</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Status & Holder</th>
                  <th className="py-4 px-6 text-right">Actions</th>
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
                      <tr key={res.id} className="hover:bg-[#F8FAFC]/50 transition">
                        <td className="py-4 px-6 font-mono font-medium text-[#64748B]">
                          {res.resource_code}
                        </td>
                        <td className="py-4 px-6 font-semibold text-[#0F172A]">
                          {res.name}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-[#0F172A]">
                            {res.category}
                          </span>
                        </td>
                        <td className="py-4 px-6 space-y-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              res.status?.toLowerCase() === "available"
                                ? "bg-green-50 text-green-600"
                                : isInUse
                                ? "bg-amber-50 text-amber-600"
                                : res.status?.toLowerCase() === "maintenance"
                                ? "bg-purple-50 text-purple-600"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {res.status}
                          </span>
                          {isInUse && res.current_user_name && (
                            <p className="text-[10px] text-blue-600 font-medium">
                              👤 Used by: <strong>{res.current_user_name}</strong>
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right space-x-3">
                          {/* Show Release button ONLY if the resource is in use AND assigned to this specific staff member */}
                          {isAssignedToMe && (
                            <button
                              onClick={() => handleReleaseResource(res.resource_code)}
                              disabled={releasingCode === res.resource_code}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-sm"
                            >
                              {releasingCode === res.resource_code ? "Releasing..." : "Release"}
                            </button>
                          )}
                          <button
                            onClick={() => openViewModal(res)}
                            className="text-[#0F172A] hover:underline font-medium cursor-pointer"
                          >
                            View Details
                          </button>
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
                <p>
                  <strong className="text-[#64748B]">Status:</strong>{" "}
                  {selectedResource.status}
                </p>
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
                    onClick={() => handleReleaseResource(selectedResource.resource_code)}
                    disabled={releasingCode === selectedResource.resource_code}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    {releasingCode === selectedResource.resource_code ? "Releasing..." : "Release Resource"}
                  </button>
                ) : (
                  <div></div>
                )}
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition cursor-pointer"
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