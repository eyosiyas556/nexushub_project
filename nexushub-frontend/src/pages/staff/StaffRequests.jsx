import { TablePageSkeleton } from "../../components/Skeletons";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../../services/api";
import socket from "../../services/socket";
import { Eye, EditPencil, Trash, Clock } from "iconoir-react";
import ConfirmationModal from "../../components/ConfirmationModal";
import ActionMenu from "../../components/ActionMenu";
import { getCachedData, setCachedData } from "../../services/cache";

const formatDateTime = (timestamp) => {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "N/A";
  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export default function StaffWorkRequests() {
  const cachedRequests = getCachedData("staff_requests");
  const cachedResources = getCachedData("system_resources");

  const [requests, setRequests] = useState(cachedRequests || []);
  const [resources, setResources] = useState(cachedResources || []);
  const [loading, setLoading] = useState(!cachedRequests);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);

  // Form state for new request
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Equipment",
    priority: "Medium",
    resource_code: "",
    requested_by: "Staff Member",
  });
  const [submitting, setSubmitting] = useState(false);

  const priorityOptions = ["Low", "Medium", "High", "Urgent"];
  const categoryOptions = ["Equipment", "Resource", "Maintenance", "IT Support", "Facilities", "Procurement", "Other"];
  const statusOptions = ["Pending", "In Progress", "Completed", "Resolved", "Rejected"];

  // Highlight parameter from notification click
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightParam = searchParams.get("highlight");
  const [activeHighlight, setActiveHighlight] = useState(null);

  useEffect(() => {
    if (highlightParam) {
      setActiveHighlight(highlightParam);
      const timer = setTimeout(() => {
        const targetEl =
          document.getElementById(`row-${highlightParam}`) ||
          document.querySelector(`[data-request-number="${highlightParam}"]`) ||
          document.querySelector(`[data-resource-code="${highlightParam}"]`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);

      const clearTimer = setTimeout(() => {
        setActiveHighlight(null);
        setSearchParams({}, { replace: true });
      }, 4000);

      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [highlightParam, requests]);

  const fetchWorkRequests = async () => {
    try {
      const response = await API.get("/staff/requests");
      const data = response.data || [];
      setRequests(data);
      setCachedData("staff_requests", data);
      setSelectedRequest((prev) => (prev ? data.find((r) => r.id === prev.id) || prev : null));
    } catch (err) {
      console.error("Failed to fetch work requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const response = await API.get("/resources"); 
      const data = response.data || [];
      setResources(data);
      setCachedData("system_resources", data);
    } catch (err) {
      console.error("Failed to fetch system resources:", err);
    }
  };

  useEffect(() => {
    fetchWorkRequests();
    fetchResources();

    // Real-time: re-fetch whenever requests data changes
    socket.on("requests_updated", fetchWorkRequests);
    socket.on("resources_updated", fetchResources);

    return () => {
      socket.off("requests_updated", fetchWorkRequests);
      socket.off("resources_updated", fetchResources);
    };
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || formData.title.trim() === "") {
      alert("Request title is mandatory.");
      return;
    }

    const isEquipOrResource = formData.category === "Equipment" || formData.category === "Resource";
    if (isEquipOrResource && (!formData.resource_code || formData.resource_code.trim() === "")) {
      alert("Selecting an available resource code is mandatory for Equipment or Resource requests.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        resource_code: isEquipOrResource ? formData.resource_code : ""
      };

      await API.post("/staff/requests", payload);
      setIsCreateModalOpen(false);
      setFormData({
        title: "",
        description: "",
        category: "Equipment",
        priority: "Medium",
        resource_code: "",
        requested_by: "Staff Member",
      });
      fetchWorkRequests();
    } catch (err) {
      console.error("Failed to create work request:", err);
      alert(err.response?.data?.error || "Failed to create work request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRequest) return;

    setSubmitting(true);
    try {
      const payload = {
        title: editingRequest.title,
        description: editingRequest.description,
        category: editingRequest.category,
        priority: editingRequest.priority,
        resource_code: editingRequest.resource_code
      };

      await API.put(`/staff/requests/${editingRequest.id}`, payload);
      setIsEditModalOpen(false);
      setEditingRequest(null);
      fetchWorkRequests();
    } catch (err) {
      console.error("Failed to update work request:", err);
      alert(err.response?.data?.error || "Failed to update work request.");
    } finally {
      setSubmitting(false);
    }
  };

  const executeDeleteRequest = async () => {
    if (!deleteConfirmId) return;
    const idToDelete = deleteConfirmId;
    setDeleteConfirmId(null);
    const updated = requests.filter((req) => req.id !== idToDelete);
    setRequests(updated);
    setCachedData("staff_requests", updated);

    try {
      await API.delete(`/staff/requests/${idToDelete}`);
      fetchWorkRequests();
    } catch (err) {
      console.error("Failed to delete request:", err);
      fetchWorkRequests();
    }
  };

  const _handleStatusChange = async (requestId, newStatus) => {
    let rejectionReason = null;

    if (newStatus.toLowerCase() === "rejected") {
      rejectionReason = window.prompt("Please enter the reason for rejecting this request:");
      if (!rejectionReason || rejectionReason.trim() === "") {
        alert("A rejection reason is required to reject a request.");
        return;
      }
    }

    try {
      const response = await API.patch(`/staff/requests/${requestId}/status`, {
        status: newStatus,
        rejection_reason: rejectionReason,
      });

      if (response.data.success) {
        fetchWorkRequests();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(err.response?.data?.error || "Failed to update status.");
    }
  };

  const openViewModal = (req) => {
    setSelectedRequest(req);
    setIsViewModalOpen(true);
  };

  const openEditModal = (req) => {
    setEditingRequest({ ...req });
    setIsEditModalOpen(true);
  };

  const filteredRequests = requests.filter((req) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      req.request_number?.toLowerCase().includes(query) ||
      req.title?.toLowerCase().includes(query) ||
      req.description?.toLowerCase().includes(query);

    const matchesStatus = statusFilter ? req.status === statusFilter : true;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <TablePageSkeleton titleWidth="w-60" hasCreateButton={true} />;
  }

  return (
    <div className="text-[#0F172A] p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              My Work Requests
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Submit and track your requests. Pending requests can be edited, and you can delete your requests at any time.
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-[#0F172A] text-white text-xs font-semibold rounded-xl hover:bg-[#000000] transition shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            + New Work Request
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">
              Search Requests
            </label>
            <input
              type="text"
              placeholder="Search by request number, title, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
            />
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

        {/* Work Requests Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[280px]">
            <table className="w-full text-left border-collapse table-fixed min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8FAFC]/80 text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">
                  <th className="w-[20%] py-4 px-5 font-bold text-[#0F172A]">Request # / Sent</th>
                  <th className="w-[26%] py-4 px-5 font-bold text-[#0F172A]">Title</th>
                  <th className="w-[18%] py-4 px-5 font-bold text-[#0F172A]">Category</th>
                  <th className="w-[13%] py-4 px-5 font-bold text-[#0F172A]">Priority</th>
                  <th className="w-[13%] py-4 px-5 font-bold text-[#0F172A]">Status</th>
                  <th className="w-[10%] py-4 px-5 text-right font-bold text-[#0F172A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[#64748B]">
                      No work requests found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const isPending = req.status?.toLowerCase() === "pending";
                    const isResolved = 
                      req.status?.toLowerCase() === "resolved" || 
                      req.status?.toLowerCase() === "closed";

                    const isHighlighted =
                      activeHighlight &&
                      (String(req.request_number || "").toLowerCase() === activeHighlight.toLowerCase() ||
                        String(req.id) === String(activeHighlight) ||
                        (req.resource_code &&
                          String(req.resource_code).toLowerCase() === activeHighlight.toLowerCase()));

                    return (
                      <tr
                        key={req.id}
                        id={`row-${req.request_number || req.id}`}
                        data-request-number={req.request_number}
                        data-resource-code={req.resource_code || ""}
                        className={`transition-all duration-700 ${
                          isHighlighted
                            ? "bg-[#F3F4F6]"
                            : "hover:bg-[#F8FAFC]/55"
                        }`}
                      >
                        <td className="py-3.5 px-5">
                          <span className="font-mono font-semibold text-[#0F172A] block truncate">
                            {req.request_number}
                          </span>
                          <span
                            className="text-[11px] text-slate-500 font-sans font-normal truncate flex items-center gap-1 mt-0.5"
                            title={formatDateTime(req.created_at)}
                          >
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{formatDateTime(req.created_at)}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                          {req.title}
                        </td>
                        <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                          {req.category}
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
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
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                              req.status === "Approved" || req.status === "Completed" || req.status === "Resolved" || req.status === "Closed"
                                ? "text-[#137333]"
                                : req.status === "In Progress"
                                ? "text-[#1A73E8]"
                                : req.status === "Pending"
                                ? "text-[#B06000]"
                                : "text-[#C5221F]"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <ActionMenu
                            actions={[
                              {
                                label: "View Details",
                                icon: <Eye className="w-4 h-4 text-slate-500" />,
                                onClick: () => openViewModal(req),
                              },
                              isPending && !isResolved && {
                                label: "Edit Request",
                                icon: <EditPencil className="w-4 h-4 text-amber-600" />,
                                onClick: () => openEditModal(req),
                              },
                              {
                                label: "Delete Request",
                                icon: <Trash className="w-4 h-4 text-rose-600" />,
                                onClick: () => setDeleteConfirmId(req.id),
                                danger: true,
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

      {/* Create Work Request Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">Submit New Work Request</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#64748B] mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Projector bulb replacement"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                  >
                    {priorityOptions.map((pri) => (
                      <option key={pri} value={pri}>{pri}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(formData.category === "Equipment" || formData.category === "Resource") && (
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">
                    Select Available Equipment <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.resource_code}
                    onChange={(e) => setFormData({ ...formData, resource_code: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="">-- Choose Resource --</option>
                    {resources
                      .filter((res) => res.status?.toLowerCase() === "available")
                      .map((res) => {
                        const code = res.code || res.resource_code || res.id;
                        const name = res.name || res.title || code;
                        return (
                          <option key={code} value={code}>
                            {name} ({code})
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">
                  Description <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows="3"
                  placeholder="Provide details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#64748B] bg-gray-100 rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Work Request Modal */}
      {isEditModalOpen && editingRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">Edit Pending Request</h3>
            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#64748B] mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingRequest.title}
                  onChange={(e) => setEditingRequest({ ...editingRequest, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">Category</label>
                  <select
                    value={editingRequest.category}
                    onChange={(e) => setEditingRequest({ ...editingRequest, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">Priority</label>
                  <select
                    value={editingRequest.priority}
                    onChange={(e) => setEditingRequest({ ...editingRequest, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                  >
                    {priorityOptions.map((pri) => (
                      <option key={pri} value={pri}>{pri}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(editingRequest.category === "Equipment" || editingRequest.category === "Resource") && (
                <div>
                  <label className="block font-semibold text-[#64748B] mb-1">
                    Resource Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingRequest.resource_code || ""}
                    onChange={(e) => setEditingRequest({ ...editingRequest, resource_code: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#64748B] mb-1">Description</label>
                <textarea
                  rows="3"
                  value={editingRequest.description || ""}
                  onChange={(e) => setEditingRequest({ ...editingRequest, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#64748B] bg-gray-100 rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">Request Details</h3>
            <div className="space-y-2 text-xs">
              <p>
                <strong className="text-[#64748B]">Request Number:</strong> {selectedRequest.request_number}
              </p>
              <p>
                <strong className="text-[#64748B]">Title:</strong> {selectedRequest.title}
              </p>
              <p>
                <strong className="text-[#64748B]">Category:</strong> {selectedRequest.category}
              </p>
              <div className="flex items-center gap-2">
                <strong className="text-[#64748B]">Priority:</strong>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                    selectedRequest.priority === "Urgent"
                      ? "text-[#C5221F]"
                      : selectedRequest.priority === "High"
                      ? "text-[#B06000]"
                      : selectedRequest.priority === "Medium"
                      ? "text-[#1A73E8]"
                      : "text-[#5F6368]"
                  }`}
                >
                  {selectedRequest.priority || "Medium"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <strong className="text-[#64748B]">Status:</strong>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                    selectedRequest.status === "Approved" || selectedRequest.status === "Completed" || selectedRequest.status === "Resolved" || selectedRequest.status === "Closed"
                      ? "text-[#137333]"
                      : selectedRequest.status === "Rejected"
                      ? "text-[#C5221F]"
                      : selectedRequest.status === "In Progress"
                      ? "text-[#1A73E8]"
                      : "text-[#B06000]"
                  }`}
                >
                  {selectedRequest.status}
                </span>
              </div>
              {selectedRequest.rejection_reason && (
                <p>
                  <strong className="text-rose-600">Rejection Reason:</strong> {selectedRequest.rejection_reason}
                </p>
              )}
              {(selectedRequest.category === "Equipment" || selectedRequest.category === "Resource") && (
                <p>
                  <strong className="text-[#64748B]">Resource Code:</strong> {selectedRequest.resource_code || "None"}
                </p>
              )}
              <p>
                <strong className="text-[#64748B]">Assigned To:</strong> {selectedRequest.assigned_to || "Unassigned"}
              </p>
              <p className="flex items-center gap-1.5">
                <strong className="text-[#64748B]">Date & Time Sent:</strong>{" "}
                <span className="text-[#0F172A] font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {formatDateTime(selectedRequest.created_at)}
                </span>
              </p>
              <p>
                <strong className="text-[#64748B]">Description:</strong>{" "}
                {selectedRequest.description || "No description provided."}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern, Eye-Friendly Frontend Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={executeDeleteRequest}
        title="Delete Work Request"
        message="Are you sure you want to delete this work request? This action cannot be undone."
        confirmText="Delete Request"
        type="danger"
      />
    </div>
  );
}