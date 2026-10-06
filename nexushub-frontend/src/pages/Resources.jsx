import React, { useState, useEffect } from "react";
import API from "../services/api";

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);

  // Form state matching database columns precisely
  const [formData, setFormData] = useState({
    resource_code: "",
    name: "",
    category: "Laptop",
    status: "Available",
    details: "",
  });

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

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const response = await API.get("/resources");
      setResources(response.data || []);
    } catch (err) {
      console.error("Failed to fetch resources:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post("/resources", formData);
      setIsAddModalOpen(false);
      fetchResources();
    } catch (err) {
      console.error("Failed to create resource:", err);
      alert("Error creating resource. Resource code might already exist.");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/resources/${selectedResource.id}`, formData);
      setIsEditModalOpen(false);
      setSelectedResource(null);
      fetchResources();
    } catch (err) {
      console.error("Failed to update resource:", err);
      alert("Error updating resource.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this resource?")) {
      try {
        await API.delete(`/resources/${id}`);
        fetchResources();
      } catch (err) {
        console.error("Failed to delete resource:", err);
        alert("Error deleting resource.");
      }
    }
  };

  const openEditModal = (res) => {
    setSelectedResource(res);
    setFormData({
      resource_code: res.resource_code || "",
      name: res.name || "",
      category: res.category || "Laptop",
      status: res.status || "Available",
      details: res.details || "",
    });
    setIsEditModalOpen(true);
  };

  const openViewModal = (res) => {
    setSelectedResource(res);
    setIsViewModalOpen(true);
  };

  const filteredResources = resources.filter((res) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      res.resource_code?.toLowerCase().includes(query) ||
      res.name?.toLowerCase().includes(query) ||
      res.in_use_by?.toLowerCase().includes(query);

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
        {/* Header & Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Resources Inventory
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Track hardware, rooms, vehicles, and company assets.
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({
                resource_code: "",
                name: "",
                category: "Laptop",
                status: "Available",
                details: "",
              });
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#0F172A] hover:bg-[#000000] text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>➕</span> Add Resource
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
              Search Resources
            </label>
            <input
              type="text"
              placeholder="Search by Code, Name, or User..."
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
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8FAFC]/50 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="py-4 px-6">Resource Code</th>
                  <th className="py-4 px-6">Resource Name</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Status & User</th>
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
                  filteredResources.map((res) => (
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
                        <div>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              res.status === "Available"
                                ? "bg-green-50 text-green-600"
                                : res.status === "In Use"
                                ? "bg-amber-50 text-amber-600"
                                : res.status === "Maintenance"
                                ? "bg-purple-50 text-purple-600"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {res.status}
                          </span>
                        </div>
                        {res.status === "In Use" && (
                          <p className="text-[11px] font-medium text-[#475569]">
                            User: <strong className="text-[#0F172A]">{res.in_use_by || res.requested_by || "Assigned Staff"}</strong>
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-3">
                        <button
                          onClick={() => openViewModal(res)}
                          className="text-[#0F172A] hover:underline font-medium cursor-pointer"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => openEditModal(res)}
                          className="text-[#D97706] hover:underline font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(res.id)}
                          className="text-[#DC2626] hover:underline font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Resource Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">Add New Resource</h3>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Resource Code
                </label>
                <input
                  required
                  type="text"
                  name="resource_code"
                  placeholder="e.g., RES-001"
                  value={formData.resource_code}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Resource Name
                </label>
                <input
                  required
                  type="text"
                  name="name"
                  placeholder="e.g., Dell Latitude 5420"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-[#0F172A]"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-[#0F172A]"
                >
                  {statusOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Details (Optional)
                </label>
                <textarea
                  rows="3"
                  name="details"
                  placeholder="Specs, location, or serial number..."
                  value={formData.details}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] bg-gray-100 rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Resource Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">Edit Resource</h3>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Resource Code
                </label>
                <input
                  required
                  type="text"
                  name="resource_code"
                  value={formData.resource_code}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Resource Name
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
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-[#0F172A]"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:border-[#0F172A]"
                >
                  {statusOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] uppercase mb-1">
                  Details (Optional)
                </label>
                <textarea
                  rows="3"
                  name="details"
                  value={formData.details}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] bg-gray-100 rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-xl hover:bg-[#000000] transition cursor-pointer"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {isViewModalOpen && selectedResource && (
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
              {selectedResource.status === "In Use" && (
                <p>
                  <strong className="text-[#64748B]">Currently Used By:</strong>{" "}
                  <span className="text-[#2563EB] font-bold">
                    {selectedResource.in_use_by || selectedResource.requested_by || "Assigned Staff"}
                  </span>
                </p>
              )}
              <p>
                <strong className="text-[#64748B]">Details:</strong>{" "}
                {selectedResource.details || "No details provided."}
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
    </div>
  );
}