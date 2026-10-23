import { TablePageSkeleton } from "../../components/Skeletons";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../../services/api";
import socket from "../../services/socket";
import { Eye, CheckCircle, Xmark, EditPencil } from "iconoir-react";
import ActionMenu from "../../components/ActionMenu";
import { getCachedData, setCachedData } from "../../services/cache";

export default function AssignedRequest() {
  const cached = getCachedData("staff_assigned_requests");
  const [assignedRequests, setAssignedRequests] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);

  // Retrieve logged-in staff name dynamically from localStorage (fallback to "Staff Member")
  const [currentStaffName] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        return parsed?.name || "Staff Member";
      }
    } catch {
      return "Staff Member";
    }
    return "Staff Member";
  });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const statusOptions = ["Pending", "In Progress", "Completed", "Rejected"];

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
  }, [highlightParam, assignedRequests]);

  const fetchAssignedRequests = async () => {
    try {
      const response = await API.get("/staff/requests/assigned", {
        headers: { "x-user-name": currentStaffName },
      });
      const data = response.data || [];
      setAssignedRequests(data);
      setCachedData("staff_assigned_requests", data);
      setSelectedRequest((prev) => (prev ? data.find((r) => r.id === prev.id) || prev : null));
    } catch (err) {
      console.error("Failed to fetch assigned requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedRequests();

    // Real-time: re-fetch whenever assigned requests change
    socket.on("requests_updated", fetchAssignedRequests);
    socket.on("resources_updated", fetchAssignedRequests);

    return () => {
      socket.off("requests_updated", fetchAssignedRequests);
      socket.off("resources_updated", fetchAssignedRequests);
    };
  }, [currentStaffName]);

  const handleStatusUpdate = async () => {
    if (!selectedRequest) return;

    if (newStatus.toLowerCase() === "rejected" && (!rejectionReason || rejectionReason.trim() === "")) {
      alert("Please provide a reason for rejecting this task.");
      return;
    }

    const reqId = selectedRequest.id;
    const targetStatus = newStatus;
    const reason = targetStatus.toLowerCase() === "rejected" ? rejectionReason : null;

    // Instant optimistic update: close modal and update state locally with 0ms delay
    setIsViewModalOpen(false);
    setRejectionReason("");
    setAssignedRequests((prev) =>
      prev.map((req) =>
        req.id === reqId ? { ...req, status: targetStatus, rejection_reason: reason } : req
      )
    );

    try {
      const response = await API.patch(
        `/staff/requests/${reqId}/status`,
        { 
          status: targetStatus,
          rejection_reason: reason
        },
        { headers: { "x-user-name": currentStaffName } }
      );

      if (response.data?.data) {
        setAssignedRequests((prev) =>
          prev.map((req) => (req.id === reqId ? response.data.data : req))
        );
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      fetchAssignedRequests();
      alert(err.response?.data?.msg || err.response?.data?.error || "Failed to update status");
    }
  };

  const openViewModal = (req) => {
    setSelectedRequest(req);
    setNewStatus(req.status);
    setRejectionReason(req.rejection_reason || "");
    setIsViewModalOpen(true);
  };

  const filteredRequests = assignedRequests.filter((req) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      req.request_number?.toLowerCase().includes(query) ||
      req.title?.toLowerCase().includes(query) ||
      req.description?.toLowerCase().includes(query) ||
      req.requested_by?.toLowerCase().includes(query);

    const matchesStatus = statusFilter ? req.status === statusFilter : true;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <TablePageSkeleton titleWidth="w-56" hasCreateButton={false} />;
  }

  return (
    <div className="text-[#0F172A] p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
            Assigned Requests
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Manage and resolve tasks and issues assigned to you by other staff members or roles.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">
              Search Assigned Tasks
            </label>
            <input
              type="text"
              placeholder="Search by request #, title, sender, or description..."
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
              {["Pending", "In Progress", "Completed", "Resolved", "Rejected"].map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assigned Requests Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[280px]">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8FAFC]/80 text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Request #</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Title</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Requested By</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Priority</th>
                  <th className="py-4 px-6 font-bold text-[#0F172A]">Status</th>
                  <th className="py-4 px-6 text-right w-32 font-bold text-[#0F172A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[#64748B]">
                      No assigned work requests found.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const isResolved = 
                      req.status?.toLowerCase() === "resolved" || 
                      req.status?.toLowerCase() === "completed" ||
                      req.status?.toLowerCase() === "closed";
                    const isRejected = req.status?.toLowerCase() === "rejected";

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
                        <td className="py-4 px-6 font-mono font-medium text-[#0F172A]">
                          {req.request_number}
                        </td>
                        <td className="py-4 px-6 font-medium text-[#0F172A]">
                          {req.title}
                        </td>
                        <td className="py-4 px-6 font-medium text-[#0F172A]">
                          {req.requested_by || "Unknown"}
                        </td>
                        <td className="py-4 px-6">
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
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                              req.status === "Approved" || req.status === "Resolved" || req.status === "Completed" || req.status === "Closed"
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
                        <td className="py-3 px-6 text-right">
                          <ActionMenu
                            actions={[
                              {
                                label: !isResolved && !isRejected ? "Manage Task" : "View Details",
                                icon: !isResolved && !isRejected ? (
                                  <EditPencil className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <Eye className="w-4 h-4 text-slate-500" />
                                ),
                                onClick: () => openViewModal(req),
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

      {/* Manage / Update Status Modal */}
      {isViewModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">Manage Assigned Task</h3>
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
              <p>
                <strong className="text-[#64748B]">Requested By:</strong> {selectedRequest.requested_by}
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
              <p>
                <strong className="text-[#64748B]">Description:</strong>{" "}
                {selectedRequest.description || "No description provided."}
              </p>
            </div>

            {/* Status Update Control */}
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <div>
                <label className="block font-semibold text-[#64748B] text-xs mb-1">
                  Update Task Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
                >
                  {statusOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* DEDICATED REJECTION REASON POPUP FIELD */}
              {newStatus.toLowerCase() === "rejected" && (
                <div className="space-y-1 bg-rose-50/60 border border-rose-100 p-3 rounded-xl animate-in fade-in duration-200">
                  <label className="block font-bold text-rose-600 text-xs">
                    Reason for Rejection <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows="3"
                    placeholder="Provide a clear explanation for why this task is being rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-rose-200 rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] bg-gray-100 rounded-xl hover:bg-gray-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={handleStatusUpdate}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition disabled:opacity-50 cursor-pointer"
              >
                {updatingStatus ? "Saving..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}