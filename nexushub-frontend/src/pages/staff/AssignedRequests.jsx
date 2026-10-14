import React, { useState, useEffect } from "react";
import API from "../../services/api";

export default function AssignedRequest() {
  const [assignedRequests, setAssignedRequests] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const fetchAssignedRequests = async () => {
    try {
      const response = await API.get("/staff/requests/assigned", {
        headers: { "x-user-name": currentStaffName },
      });
      setAssignedRequests(response.data || []);
    } catch (err) {
      console.error("Failed to fetch assigned requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedRequests();
  }, [currentStaffName]);

  const handleStatusUpdate = async () => {
    if (!selectedRequest) return;

    if (newStatus.toLowerCase() === "rejected" && (!rejectionReason || rejectionReason.trim() === "")) {
      alert("Please provide a reason for rejecting this task.");
      return;
    }

    setUpdatingStatus(true);
    try {
      const response = await API.patch(
        `/staff/requests/${selectedRequest.id}/status`,
        { 
          status: newStatus,
          rejection_reason: newStatus.toLowerCase() === "rejected" ? rejectionReason : null
        },
        { headers: { "x-user-name": currentStaffName } }
      );

      // Update local state
      setAssignedRequests(
        assignedRequests.map((req) => (req.id === selectedRequest.id ? response.data.data : req))
      );
      setSelectedRequest(response.data.data);
      setIsViewModalOpen(false);
      setRejectionReason("");
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(err.response?.data?.msg || err.response?.data?.error || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
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
    return (
      <div className="h-full bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        <p className="text-sm font-medium animate-pulse">Loading assigned tasks...</p>
      </div>
    );
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
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
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
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8FAFC]/50 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="py-4 px-6">Request #</th>
                  <th className="py-4 px-6">Title</th>
                  <th className="py-4 px-6">Requested By</th>
                  <th className="py-4 px-6">Priority</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
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
                      req.status?.toLowerCase() === "closed";

                    return (
                      <tr key={req.id} className="hover:bg-[#F8FAFC]/50 transition">
                        <td className="py-4 px-6 font-mono font-medium text-[#64748B]">
                          {req.request_number}
                        </td>
                        <td className="py-4 px-6 font-semibold text-[#0F172A]">
                          {req.title}
                        </td>
                        <td className="py-4 px-6 text-[#64748B]">
                          {req.requested_by || "Unknown"}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              req.priority === "Urgent"
                                ? "bg-red-50 text-red-600"
                                : req.priority === "High"
                                ? "bg-orange-50 text-orange-600"
                                : req.priority === "Medium"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {req.priority}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              req.status === "Resolved" || req.status === "Completed" || req.status === "Closed"
                                ? "bg-green-50 text-green-600"
                                : req.status === "In Progress"
                                ? "bg-amber-50 text-amber-600"
                                : req.status === "Pending"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          {/* Disappears if admin has marked it Resolved or Closed */}
                          {!isResolved ? (
                            <button
                              onClick={() => openViewModal(req)}
                              className="text-[#0F172A] hover:underline font-semibold cursor-pointer"
                            >
                              Manage Task
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-semibold italic text-[11px]">
                              Completed & Resolved
                            </span>
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
              <p>
                <strong className="text-[#64748B]">Priority:</strong> {selectedRequest.priority}
              </p>
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