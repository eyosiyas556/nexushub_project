import { TablePageSkeleton } from "../components/Skeletons";
import React, { useState, useEffect } from "react";
import API from "../services/api";
import socket from "../services/socket";
import { Eye, EditPencil, Trash, Check, Xmark } from "iconoir-react";
import ConfirmationModal from "../components/ConfirmationModal";
import ActionMenu from "../components/ActionMenu";
import { getCachedData, setCachedData } from "../services/cache";

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
  });

  // Rejection reason state
  const [rejectionReason, setRejectionReason] = useState("");

  const priorities = ["Low", "Medium", "High", "Urgent"];
  const statuses = ["Pending", "Approved", "In Progress", "Resolved", "Rejected", "Closed"];

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

    return () => {
      socket.off("requests_updated", fetchRequests);
      socket.off("members_updated", fetchRequests);
      socket.off("resources_updated", fetchRequests);
    };
  }, []);

  const fetchAssignableStaff = async (requestId) => {
    try {
      const response = await API.get(`/requests/${requestId}/assignable-staff`);
      setTeamMembers(response.data || []);
    } catch (err) {
      console.error("Failed to fetch assignable staff members:", err);
      setTeamMembers([]);
    }
  };

  // Handle direct Approve for Equipment / Resource requests
  const handleApprove = async (req) => {
    try {
      const updatedPayload = {
        ...req,
        status: "Approved",
      };
      await API.put(`/requests/${req.id}`, updatedPayload);
      fetchRequests();
    } catch (err) {
      console.error("Failed to approve request:", err);
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

    try {
      const updatedPayload = {
        ...selectedRequest,
        status: "Rejected",
        rejection_reason: rejectionReason,
      };
      await API.put(`/requests/${selectedRequest.id}`, updatedPayload);
      setIsRejectModalOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      fetchRequests();
    } catch (err) {
      console.error("Failed to reject request:", err);
      alert(err.response?.data?.error || "Error rejecting request.");
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    try {
      const updatedPayload = {
        ...selectedRequest,
        assigned_to: assignData.assigned_to,
        status: assignData.status,
        priority: assignData.priority,
      };
      await API.put(`/requests/${selectedRequest.id}`, updatedPayload);
      setIsAssignModalOpen(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      console.error("Failed to assign request:", err);
      alert(err.response?.data?.error || "Error assigning request.");
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await API.delete(`/requests/${deleteConfirmId}`);
      fetchRequests();
    } catch (err) {
      console.error("Failed to delete work request:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const openViewModal = (req) => {
    setSelectedRequest(req);
    setIsViewModalOpen(true);
  };

  const openAssignModal = async (req) => {
    setSelectedRequest(req);
    setAssignData({
      assigned_to: req.assigned_to || "",
      status: req.status || "Pending",
      priority: req.priority || "Medium",
    });
    // Fetch staff members excluding the requester & admins for this specific request
    await fetchAssignableStaff(req.id);
    setIsAssignModalOpen(true);
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
              Manage requests. Equipment rows feature direct Approve/Reject controls; other categories can be edited and assigned to staff.
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
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8FAFC]/80 text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Request #</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Title</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Category</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Priority</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Status / Assigned</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Requested By</th>
                  <th className="py-4 px-6 text-right w-36 font-bold text-[#0F172A]">Actions</th>
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

                    return (
                      <tr
                        key={req.id}
                        className="hover:bg-[#F8FAFC]/55 transition"
                      >
                        <td className="py-4 px-6 font-mono font-medium text-[#0F172A]">
                          {req.request_number}
                        </td>
                        <td className="py-4 px-6 font-medium text-[#0F172A]">
                          {req.title}
                          {req.resource_code && (
                            <span className="block text-[10px] font-mono text-slate-500 font-normal">
                              Asset: {req.resource_code}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-medium text-[#0F172A]">
                          {req.category}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              req.priority === "Urgent"
                                ? "bg-[#FCE8E6] text-[#C5221F]"
                                : req.priority === "High"
                                ? "bg-[#FEF7E0] text-[#B06000]"
                                : req.priority === "Medium"
                                ? "bg-[#E8F0FE] text-[#1A73E8]"
                                : "bg-[#F1F3F4] text-[#5F6368]"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                req.priority === "Urgent"
                                  ? "bg-[#C5221F]"
                                  : req.priority === "High"
                                  ? "bg-[#B06000]"
                                  : req.priority === "Medium"
                                  ? "bg-[#1A73E8]"
                                  : "bg-[#5F6368]"
                              }`}
                            />
                            {req.priority || "Medium"}
                          </span>
                        </td>
                        {/* Status Column without background */}
                        <td className="py-4 px-6">
                          {isEquipment ? (
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  req.status === "Approved" || req.status === "Completed"
                                    ? "bg-[#E6F4EA] text-[#137333]"
                                    : req.status === "Rejected"
                                    ? "bg-[#FCE8E6] text-[#C5221F]"
                                    : req.status === "In Progress"
                                    ? "bg-[#E8F0FE] text-[#1A73E8]"
                                    : "bg-[#FEF7E0] text-[#B06000]"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    req.status === "Approved" || req.status === "Completed"
                                      ? "bg-[#137333]"
                                      : req.status === "Rejected"
                                      ? "bg-[#C5221F]"
                                      : req.status === "In Progress"
                                      ? "bg-[#1A73E8]"
                                      : "bg-[#B06000]"
                                  }`}
                                />
                                {req.status || "Pending"}
                              </span>

                              {!isLocked && statusLower === "pending" && (
                                <div className="flex items-center gap-1 ml-1">
                                  <button
                                    type="button"
                                    onClick={() => handleApprove(req)}
                                    title="Approve Request"
                                    aria-label="Approve"
                                    className="p-1 text-emerald-600 hover:text-emerald-700 transition cursor-pointer inline-flex items-center"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openRejectModal(req)}
                                    title="Reject Request"
                                    aria-label="Reject"
                                    className="p-1 text-red-600 hover:text-red-700 transition cursor-pointer inline-flex items-center"
                                  >
                                    <Xmark className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  req.status === "Approved" || req.status === "Resolved" || req.status === "Closed" || req.status === "Completed"
                                    ? "bg-[#E6F4EA] text-[#137333]"
                                    : req.status === "Rejected"
                                    ? "bg-[#FCE8E6] text-[#C5221F]"
                                    : req.status === "In Progress"
                                    ? "bg-[#E8F0FE] text-[#1A73E8]"
                                    : "bg-[#FEF7E0] text-[#B06000]"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    req.status === "Approved" || req.status === "Resolved" || req.status === "Closed" || req.status === "Completed"
                                      ? "bg-[#137333]"
                                      : req.status === "Rejected"
                                      ? "bg-[#C5221F]"
                                      : req.status === "In Progress"
                                      ? "bg-[#1A73E8]"
                                      : "bg-[#B06000]"
                                  }`}
                                />
                                {req.status || "Pending"}
                              </span>
                              <p className="text-[11px] font-medium text-slate-500">
                                Assigned: <strong className="text-[#0F172A] font-medium">{req.assigned_to || "Unassigned"}</strong>
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 font-medium text-[#0F172A]">
                          {req.requested_by}
                        </td>
                        {/* Actions Column */}
                        <td className="py-3 px-6 text-right">
                          <ActionMenu
                            actions={[
                              {
                                label: "View Details",
                                icon: <Eye className="w-4 h-4 text-slate-500" />,
                                onClick: () => openViewModal(req),
                              },
                              !isLocked && statusLower === "pending" && {
                                label: "Approve Request",
                                icon: <Check className="w-4 h-4 text-emerald-600" />,
                                onClick: () => handleApprove(req),
                              },
                              !isLocked && statusLower === "pending" && {
                                label: "Reject Request",
                                icon: <Xmark className="w-4 h-4 text-rose-600" />,
                                onClick: () => openRejectModal(req),
                                danger: true,
                              },
                              !isEquipment && {
                                label: "Assign / Update",
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

      {/* Rejection Reason Modal */}
      {isRejectModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">
              Reject Request: {selectedRequest.request_number}
            </h3>
            <p className="text-xs text-[#64748B]">
              Please provide a reason for rejecting this request. This will be sent as a notification to <strong className="text-[#0F172A]">{selectedRequest.requested_by}</strong>.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#64748B] mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g., Resource is currently unavailable or under maintenance..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#64748B] bg-gray-100 rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition cursor-pointer"
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
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedRequest.priority === "Urgent"
                      ? "bg-[#FCE8E6] text-[#C5221F]"
                      : selectedRequest.priority === "High"
                      ? "bg-[#FEF7E0] text-[#B06000]"
                      : selectedRequest.priority === "Medium"
                      ? "bg-[#E8F0FE] text-[#1A73E8]"
                      : "bg-[#F1F3F4] text-[#5F6368]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      selectedRequest.priority === "Urgent"
                        ? "bg-[#C5221F]"
                        : selectedRequest.priority === "High"
                        ? "bg-[#B06000]"
                        : selectedRequest.priority === "Medium"
                        ? "bg-[#1A73E8]"
                        : "bg-[#5F6368]"
                    }`}
                  />
                  {selectedRequest.priority || "Medium"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <strong className="text-[#64748B]">Status:</strong>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedRequest.status === "Resolved" || selectedRequest.status === "Closed" || selectedRequest.status === "Approved" || selectedRequest.status === "Completed"
                      ? "bg-[#E6F4EA] text-[#137333]"
                      : selectedRequest.status === "Rejected"
                      ? "bg-[#FCE8E6] text-[#C5221F]"
                      : selectedRequest.status === "In Progress"
                      ? "bg-[#E8F0FE] text-[#1A73E8]"
                      : "bg-[#FEF7E0] text-[#B06000]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      selectedRequest.status === "Resolved" || selectedRequest.status === "Closed" || selectedRequest.status === "Approved" || selectedRequest.status === "Completed"
                        ? "bg-[#137333]"
                        : selectedRequest.status === "Rejected"
                        ? "bg-[#C5221F]"
                        : selectedRequest.status === "In Progress"
                        ? "bg-[#1A73E8]"
                        : "bg-[#B06000]"
                    }`}
                  />
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
            <h3 className="text-lg font-bold text-[#0F172A]">
              Edit / Assign Request: {selectedRequest.request_number}
            </h3>
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
                    {statuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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