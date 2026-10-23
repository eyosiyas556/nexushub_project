import { TablePageSkeleton } from "../components/Skeletons";
import React, { useState, useEffect } from "react";
import API from "../services/api";
import socket from "../services/socket";
import { Eye, EditPencil, Trash, Plus } from "iconoir-react";
import ConfirmationModal from "../components/ConfirmationModal";
import ActionMenu from "../components/ActionMenu";
import { getCachedData, setCachedData } from "../services/cache";

export default function Members() {
  const cached = getCachedData("admin_members");
  const [members, setMembers] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [selectedMember, setSelectedMember] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    role: "Staff",
    status: "Active",
    password: "", // Required for database user creation
  });

  const fetchMembers = async () => {
    try {
      const response = await API.get("/members");
      const data = response.data || [];
      setMembers(data);
      setCachedData("admin_members", data);
      setSelectedMember((prev) => (prev ? data.find((m) => m.id === prev.id) || prev : null));
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();

    // Real-time: re-fetch whenever members data changes
    socket.on("members_updated", fetchMembers);

    const handleSync = () => fetchMembers();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleSync();
    };
    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleVisibility);
    const syncInterval = setInterval(handleSync, 8000);

    return () => {
      socket.off("members_updated", fetchMembers);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(syncInterval);
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post("/members", formData);
      setIsAddModalOpen(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        department: "",
        role: "Staff",
        status: "Active",
        password: "",
      });
      fetchMembers();
    } catch (err) {
      console.error("Failed to add member:", err);
      alert(
        err.response?.data?.error ||
          "Error adding member. Please check input values.",
      );
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/members/${selectedMember.id}`, formData);
      setIsEditModalOpen(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (err) {
      console.error("Failed to update member:", err);
      alert(err.response?.data?.error || "Error updating member.");
    }
  };

  const executeDeleteMember = async () => {
    if (!deleteConfirmId) return;
    try {
      await API.delete(`/members/${deleteConfirmId}`);
      fetchMembers();
    } catch (err) {
      console.error("Failed to delete member:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const openEditModal = (member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone || "",
      department: member.department,
      role: member.role || "Staff",
      status: member.status,
      password: "", // Leave blank on edit unless changing
    });
    setIsEditModalOpen(true);
  };

  const openViewModal = (member) => {
    setSelectedMember(member);
    setIsViewModalOpen(true);
  };

  // Filter and search logic
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = departmentFilter
      ? member.department === departmentFilter
      : true;
    const matchesStatus = statusFilter ? member.status === statusFilter : true;

    return matchesSearch && matchesDept && matchesStatus;
  });

  if (loading) {
    return <TablePageSkeleton titleWidth="w-56" hasCreateButton={true} />;
  }

  return (
    <div className="text-[#0F172A] p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Team Members
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Manage personnel directory, departmental assignments, and status.
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({
                name: "",
                email: "",
                phone: "",
                department: "",
                role: "Staff",
                status: "Active",
                password: "",
              });
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#0F172A] hover:bg-[#000000] text-white text-xs font-bold rounded-xl shadow-sm transition duration-200 flex items-center justify-center gap-2 self-start sm:self-auto w-full sm:w-auto cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1" /> Add New Member
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-[#FFFFFF] border border-gray-100 p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">Search Directory</label>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
            >
              <option value="">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Operations">Operations</option>
              <option value="Finance">Finance</option>
              <option value="HR & Admin">HR & Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] uppercase tracking-wider mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-gray-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Members Table */}
        <div className="bg-[#FFFFFF] border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[280px]">
            <table className="w-full text-left border-collapse table-fixed min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8FAFC]/80 text-[11px] font-bold text-[#0F172A] uppercase tracking-wider">
                  <th className="py-4 px-5 w-[18%] font-bold text-[#0F172A]">Name</th>
                  <th className="py-4 px-5 w-[22%] font-bold text-[#0F172A]">Email</th>
                  <th className="py-4 px-5 w-[14%] font-bold text-[#0F172A]">Phone</th>
                  <th className="py-4 px-5 w-[15%] font-bold text-[#0F172A]">Department</th>
                  <th className="py-4 px-5 w-[11%] font-bold text-[#0F172A]">Role</th>
                  <th className="py-4 px-5 w-[10%] font-bold text-[#0F172A]">Status</th>
                  <th className="py-4 px-5 w-[10%] text-right font-bold text-[#0F172A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-[#64748B]">
                      No team members found matching your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-[#F8FAFC]/55 transition"
                    >
                      <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                        {member.name}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                        {member.email}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                        {member.phone || "N/A"}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                        {member.department}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-[#0F172A] truncate">
                        {member.role || "Staff"}
                      </td>
                      <td className="py-3.5 px-5 font-medium">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                            member.status === "Active"
                              ? "text-[#137333]"
                              : "text-[#5F6368]"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <ActionMenu
                          actions={[
                            {
                              label: "View Details",
                              icon: <Eye className="w-4 h-4 text-slate-500" />,
                              onClick: () => openViewModal(member),
                            },
                            {
                              label: "Edit Member",
                              icon: <EditPencil className="w-4 h-4 text-amber-600" />,
                              onClick: () => openEditModal(member),
                            },
                            {
                              label: "Delete Member",
                              icon: <Trash className="w-4 h-4 text-rose-600" />,
                              onClick: () => setDeleteConfirmId(member.id),
                              danger: true,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 my-8">
            <h3 className="text-lg font-bold text-[#0F172A]">
              Add Team Member
            </h3>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Temporary Password
                </label>
                <input
                  required
                  type="password"
                  name="password"
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Department
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                  required
                >
                  <option value="">Select Department</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Operations">Operations</option>
                  <option value="Finance">Finance</option>
                  <option value="HR & Admin">HR & Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                  required
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Manager">Manager</option>
                  <option value="Staff">Staff</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#0F172A] bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 my-8">
            <h3 className="text-lg font-bold text-[#0F172A]">
              Edit Team Member
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Department
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                  required
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Operations">Operations</option>
                  <option value="Finance">Finance</option>
                  <option value="HR & Admin">HR & Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                  required
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Manager">Manager</option>
                  <option value="Staff">Staff</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#0F172A] uppercase mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#0F172A] bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition"
                >
                  Update Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 my-8">
            <h3 className="text-lg font-bold text-[#0F172A]">Member Details</h3>
            <div className="space-y-2 text-xs">
              <p>
                <strong className="text-[#64748B]">Name:</strong>{" "}
                {selectedMember.name}
              </p>
              <p>
                <strong className="text-[#64748B]">Email:</strong>{" "}
                {selectedMember.email}
              </p>
              <p>
                <strong className="text-[#64748B]">Phone:</strong>{" "}
                {selectedMember.phone || "N/A"}
              </p>
              <p>
                <strong className="text-[#64748B]">Department:</strong>{" "}
                {selectedMember.department}
              </p>
              <p>
                <strong className="text-[#64748B]">Role:</strong>{" "}
                {selectedMember.role || "Staff"}
              </p>
              <div className="flex items-center gap-2">
                <strong className="text-[#64748B]">Status:</strong>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F8FAFC] border border-slate-200/80 ${
                    selectedMember.status === "Active"
                      ? "text-[#137333]"
                      : "text-[#5F6368]"
                  }`}
                >
                  {selectedMember.status}
                </span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition"
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
        onConfirm={executeDeleteMember}
        title="Delete Team Member"
        message="Are you sure you want to remove this team member? This action cannot be undone."
        confirmText="Delete Member"
        type="danger"
      />
    </div>
  );
}