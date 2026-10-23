import { TablePageSkeleton } from "../components/Skeletons";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../services/api";
import socket from "../services/socket";
import { Eye, EditPencil, Trash, Check, Xmark, Clock } from "iconoir-react";
import ConfirmationModal from "../components/ConfirmationModal";
import ActionMenu from "../components/ActionMenu";
import { getCachedData, setCachedData } from "../services/cache";

const parseSafeDate = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  let str = String(timestamp).trim();
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('GMT')) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date(timestamp) : d;
};

const formatDate = (timestamp) => {
  const date = parseSafeDate(timestamp);
  if (!date || isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (timestamp) => {
  const date = parseSafeDate(timestamp);
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return "N/A";
  const d = formatDate(timestamp);
  const t = formatTime(timestamp);
  return t ? `${d} at ${t}` : d;
};

export default function Requests() {
  const cached = getCachedData("admin_requests");
  const [requests, setRequests] = useState(cached || []);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(!cached);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Form state for assignment
  const [assignData, setAssignData] = useState({
    assigned_to: "",
    status: "Pending",
    priority: "Medium",
    rejection_reason: "",
  });

  // Rejection reason state
  const [rejectionReason, setRejectionReason] = useState("");

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

  const priorities = ["Low", "Medium", "High", "Urgent"];
  const statuses = ["Pending", "Approved", "In Progress", "Resolved", "Rejected", "Closed"];
  // For other (non-equipment) requests, admin has strictly 3 statuses: Pending, Rejected, Resolved
  const otherRequestStatuses = ["Pending", "Rejected", "Resolved"];

  const fetchRequests = async () => {
    try {
      const response = await API.get("/requests");
      const data = response.data || [];
      setRequests(data);
      setCachedData("admin_requests", data);
      setSelectedRequest((prev) => (prev ? data.find((r) => r.id === prev.id) || prev : null));
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Real-time: re-fetch whenever any request or related data changes
    socket.on("requests_updated", fetchRequests);
    socket.on("members_updated", fetchRequests);
    socket.on("resources_updated", fetchRequests);

    // Resilient fallback sync between devices (Phone/PC)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchRequests();
    };
    window.addEventListener("focus", fetchRequests);
    document.addEventListener("visibilitychange", handleVisibility);
    const syncInterval = setInterval(fetchRequests, 7000);

    return () => {
      socket.off("requests_updated", fetchRequests);
      socket.off("members_updated", fetchRequests);
      socket.off("resources_updated", fetchRequests);
      window.removeEventListener("focus", fetchRequests);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(syncInterval);
    };
  }, []);

  const fetchAssignableStaff = async (requestId) => {
    try {
      const response = await API.get(`/requests/${requestId}/assignable-staff`);
      if (response.data && response.data.length > 0) {
        setTeamMembers(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch assignable staff members:", err);
    }
  };

  // Pre-fetch team members in background on page load so Assign modal opens instantly
  useEffect(() => {
    const cachedMembers = getCachedData("admin_members");
    if (!cachedMembers || cachedMembers.length === 0) {
      API.get("/members")
        .then((res) => {
          if (res.data) setCachedData("admin_members", res.data);
        })
        .catch(() => {});
    }
  }, []);

  // Handle direct Approve for Equipment / Resource requests
  const handleApprove = async (req) => {
    // Instant optimistic update: change status locally with 0ms delay
    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: "Approved" } : r))
    );
    try {
      const updatedPayload = {
        ...req,
        status: "Approved",
      };
      await API.put(`/requests/${req.id}`, updatedPayload);
      fetchRequests();
    } catch (err) {
      console.error("Failed to approve request:", err);
      fetchRequests();
      alert(err.response?.data?.error || "Error approving request.");
    }
  };

  // Open Rejection Modal
  const openRejectModal = (req) => {
    setSelectedRequest(req);
    setRejectionReason("");
    setIsRejectModalOpen(true);
  };

  // Handle Submit Rejection with Reason
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const reqId = selectedRequest.id;
    const reason = rejectionReason;
    const updatedPayload = {
      ...selectedRequest,
      status: "Rejected",
      rejection_reason: reason,
    };

    // Instant optimistic update: close modal and update status locally immediately
    setIsRejectModalOpen(false);
    setSelectedRequest(null);
    setRejectionReason("");
    setRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: "Rejected", rejection_reason: reason } : r))
    );

    try {
      await API.put(`/requests/${reqId}`, updatedPayload);
      fetchRequests();
    } catch (err) {
      console.error("Failed to reject request:", err);
      fetchRequests();
      alert(err.response?.data?.error || "Error rejecting request.");
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const reqId = selectedRequest.id;
    const updatedPayload = {
      ...selectedRequest,
      assigned_to: assignData.assigned_to,
      status: assignData.status,
      priority: assignData.priority,
      rejection_reason: assignData.status === "Rejected" ? assignData.rejection_reason : selectedRequest.rejection_reason,
    };

    // Instant optimistic update: close modal and update status locally immediately
    setIsAssignModalOpen(false);
    setSelectedRequest(null);
    setRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, ...updatedPayload } : r))
    );

    try {
      await API.put(`/requests/${reqId}`, updatedPayload);
      fetchRequests();
    } catch (err) {
      console.error("Failed to assign request:", err);
      fetchRequests();
      alert(err.response?.data?.error || "Error assigning request.");
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    const idToDelete = deleteConfirmId;
    // Instant optimistic update: close modal and remove from list immediately
    setDeleteConfirmId(null);
    setRequests((prev) => prev.filter((r) => r.id !== idToDelete));

    try {
      await API.delete(`/requests/${idToDelete}`);
      fetchRequests();
    } catch (err) {
      console.error("Failed to delete work request:", err);
      fetchRequests();
    }
  };

  const openViewModal = (req) => {
    setSelectedRequest(req);
    setIsViewModalOpen(true);
  };

  const openAssignModal = (req) => {
    setSelectedRequest(req);
    setAssignData({
      assigned_to: req.assigned_to || "",
      status: ["Pending", "Rejected", "Resolved"].includes(req.status) ? req.status : "Pending",
      rejection_reason: req.rejection_reason || "",
      priority: req.priority || "Medium",
    });

    // Populate instantly from cache so there is 0ms delay
    const cachedMembers = getCachedData("admin_members");
    if (cachedMembers && cachedMembers.length > 0) {
      const eligibleStaff = cachedMembers.filter(
        (m) =>
          (m.role || "").toLowerCase() === "staff" &&
          m.id !== req.user_id &&
          m.name?.trim().toLowerCase() !== (req.requested_by || "").trim().toLowerCase()
      );
      if (eligibleStaff.length > 0) {
        setTeamMembers(eligibleStaff);
      }
    }

    // Open modal IMMEDIATELY without waiting for network request
    setIsAssignModalOpen(true);

    // Refresh fresh eligible staff in background
    fetchAssignableStaff(req.id);
  };

  const filteredRequests = requests.filter((req) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      req.request_number?.toLowerCase().includes(query) ||
      req.title?.toLowerCase().includes(query) ||
      req.requested_by?.toLowerCase().includes(query);

    const matchesStatus = statusFilter ? req.status === statusFilter : true;
    const matchesPriority = priorityFilter
      ? req.priority === priorityFilter
      : true;

    return matchesSearch && matchesStatus && matchesPriority;
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
              Work Requests Management
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Review requests. Use the 3-dots menu to Approve or Reject equipment requests with reasons, or to View, Assign, and Update other requests.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">Search Requests</label>
            <input
              type="text"
              placeholder="Search by Request Number, Title, or Requester..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">All Statuses</option>
              {statuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">Filter by Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">All Priorities</option>
              {priorities.map((pr) => (
                <option key={pr} value={pr}>
                  {pr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Work Requests Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[280px]">
            <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8FAFC]/80 text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">
                  <th className="py-4 px-5 w-[16%] font-bold text-[#0F172A]">Request # / Sent</th>
                  <th className="py-4 px-5 w-[22%] font-bold text-[#0F172A]">Title</th>
                  <th className="py-4 px-5 w-[13%] font-bold text-[#0F172A]">Category</th>
                  <th className="py-4 px-5 w-[12%] font-bold text-[#0F172A]">Priority</th>
                  <th className="py-4 px-5 w-[15%] font-bold text-[#0F172A]">Status / Assigned</th>
                  <th className="py-4 px-5 w-[12%] font-bold text-[#0F172A]">Requested By</th>
                  <th className="py-4 px-5 w-[10%] text-right font-bold text-[#0F172A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-[#64748B]">
                      No work requests found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const isEquipment = req.category?.toLowerCase().includes("equipment") || req.category?.toLowerCase().includes("resource");
                    const statusLower = (req.status || "").toLowerCase();
                    const isLocked = ["closed", "resolved", "completed"].includes(statusLower);

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
                        <td className="py-3 px-5">
                          <span className="font-mono font-semibold text-[#0F172A] block truncate">
                            {req.request_number}
                          </span>
                          {req.created_at ? (
                            <div className="text-[11px] text-slate-500 font-sans mt-0.5 space-y-0.5 leading-tight">
                              <span className="block text-slate-600 font-medium whitespace-nowrap">
                                {formatDate(req.created_at)}
                              </span>
                              <span className="flex items-center gap-1 text-slate-400 whitespace-nowrap font-normal">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{formatTime(req.created_at)}</span>
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-5 font-medium text-[#0F172A]">
                          <span className="block truncate">{req.title}</span>
                          {req.resource_code && (
                            <span className="block text-[10px] font-mono text-slate-500 font-normal">
                              Asset: {req.resource_code}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                          {req.category}
                        </td>
                        <td className="py-3.5 px-5">
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
                        {/* Status Column */}
                        <td className="py-3.5 px-5">
                          {isEquipment ? (
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                                req.status === "Approved" || req.status === "Completed"
                                  ? "text-[#137333]"
                                  : req.status === "Rejected"
                                  ? "text-[#C5221F]"
                                  : req.status === "In Progress"
                                  ? "text-[#1A73E8]"
                                  : "text-[#B06000]"
                              }`}
                            >
                              {req.status || "Pending"}
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                                  req.status === "Approved" || req.status === "Resolved" || req.status === "Closed" || req.status === "Completed"
                                    ? "text-[#137333]"
                                    : req.status === "Rejected"
                                    ? "text-[#C5221F]"
                                    : req.status === "In Progress"
                                    ? "text-[#1A73E8]"
                                    : "text-[#B06000]"
                                }`}
                              >
                                {req.status || "Pending"}
                              </span>
                              <p className="text-[11px] font-medium text-slate-500 truncate">
                                Assigned: <strong className="text-[#0F172A] font-medium">{req.assigned_to || "Unassigned"}</strong>
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                          {req.requested_by}
                        </td>
                        {/* Actions Column */}
                        <td className="py-3.5 px-5 text-right">
                          {isEquipment ? (
                            <ActionMenu
                              actions={
                                !isLocked && statusLower === "pending"
                                  ? [
                                      {
                                        label: "Approve Request",
                                        icon: <Check className="w-4 h-4 text-emerald-600" />,
                                        onClick: () => handleApprove(req),
                                      },
                                      {
                                        label: "Reject Request",
                                        icon: <Xmark className="w-4 h-4 text-rose-600" />,
                                        onClick: () => openRejectModal(req),
                                        danger: true,
                                      },
                                    ]
                                  : [
                                      {
                                        label: "View Details",
                                        icon: <Eye className="w-4 h-4 text-slate-500" />,
                                        onClick: () => openViewModal(req),
                                      },
                                      {
                                        label: "Delete Request",
                                        icon: <Trash className="w-4 h-4 text-rose-600" />,
                                        onClick: () => setDeleteConfirmId(req.id),
                                        danger: true,
                                      },
                                    ]
                              }
                            />
                          ) : (
                            <ActionMenu
                              actions={[
                                {
                                  label: "View Details",
                                  icon: <Eye className="w-4 h-4 text-slate-500" />,
                                  onClick: () => openViewModal(req),
                                },
                                {
                                  label: "Assign / Edit",
                                  icon: <EditPencil className="w-4 h-4 text-amber-600" />,
                                  onClick: () => openAssignModal(req),
                                },
                                {
                                  label: "Delete Request",
                                  icon: <Trash className="w-4 h-4 text-rose-600" />,
                                  onClick: () => setDeleteConfirmId(req.id),
                                  danger: true,
                                },
                              ]}
                            />
                          )}
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

      {/* Rejection Reason Modal - Card to give reason when Reject is clicked for equipment requests */}
      {isRejectModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Reject Equipment Request
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Request <span className="font-mono font-semibold text-[#0F172A]">{selectedRequest.request_number}</span> &bull; {selectedRequest.title}
                </p>
                <p className="text-[11px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Sent: {formatDateTime(selectedRequest.created_at)}
                </p>
              </div>
              <span className="p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                <Xmark className="w-4 h-4" />
              </span>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Please provide a reason for rejecting this equipment request. This will be sent as a real-time notification to <strong className="text-[#0F172A]">{selectedRequest.requested_by}</strong>.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1.5">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g., Resource is currently reserved, undergoing maintenance, or not available..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#64748B] bg-gray-100 rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition cursor-pointer shadow-sm"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">
              Request Details
            </h3>
            <div className="space-y-2 text-xs">
              <p>
                <strong className="text-[#64748B]">Request Number:</strong>{" "}
                {selectedRequest.request_number}
              </p>
              <p>
                <strong className="text-[#64748B]">Title:</strong>{" "}
                {selectedRequest.title}
              </p>
              <p>
                <strong className="text-[#64748B]">Category:</strong>{" "}
                {selectedRequest.category}
              </p>
              {selectedRequest.resource_code && (
                <p>
                  <strong className="text-[#64748B]">
                    Linked Resource Code:
                  </strong>{" "}
                  <span className="font-mono text-blue-600">
                    {selectedRequest.resource_code}
                  </span>
                </p>
              )}
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
                    selectedRequest.status === "Resolved" || selectedRequest.status === "Closed" || selectedRequest.status === "Approved" || selectedRequest.status === "Completed"
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
              <p>
                <strong className="text-[#64748B]">Assigned To:</strong>{" "}
                {selectedRequest.assigned_to || "Unassigned"}
              </p>
              <p>
                <strong className="text-[#64748B]">Requested By:</strong>{" "}
                {selectedRequest.requested_by}
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
                className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign / Edit Staff Modal */}
      {isAssignModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">
                Edit / Assign Request: {selectedRequest.request_number}
              </h3>
              <p className="text-[11px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Sent on {formatDateTime(selectedRequest.created_at)}
              </p>
            </div>
            <form onSubmit={handleAssignSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Assign To Staff Member
                </label>
                <select
                  value={assignData.assigned_to}
                  onChange={(e) =>
                    setAssignData({ ...assignData, assigned_to: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                >
                  <option value="">-- Select Team Member --</option>
                  {assignData.assigned_to && !teamMembers.some((m) => m.name === assignData.assigned_to) && (
                    <option value={assignData.assigned_to}>
                      {assignData.assigned_to}
                    </option>
                  )}
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.name}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                    Priority
                  </label>
                  <select
                    value={assignData.priority}
                    onChange={(e) =>
                      setAssignData({ ...assignData, priority: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                  >
                    {priorities.map((pr) => (
                      <option key={pr} value={pr}>
                        {pr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={assignData.status}
                    onChange={(e) =>
                      setAssignData({ ...assignData, status: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                  >
                    {otherRequestStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {assignData.status === "Rejected" && (
                <div className="space-y-1 bg-rose-50/60 border border-rose-100 p-3 rounded-xl animate-in fade-in duration-150 text-xs">
                  <label className="block font-bold text-rose-600 text-xs">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Provide a clear reason for rejecting this request..."
                    value={assignData.rejection_reason || ""}
                    onChange={(e) => setAssignData({ ...assignData, rejection_reason: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-rose-200 rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-xl cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern, Eye-Friendly Frontend Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={executeDelete}
        title="Delete Work Request"
        message="Are you sure you want to delete this work request? This action cannot be undone."
        confirmText="Delete Request"
        type="danger"
      />
    </div>
  );
}