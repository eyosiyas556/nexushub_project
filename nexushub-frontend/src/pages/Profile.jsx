import React, { useState, useEffect, useRef } from "react";
import API, { getMediaUrl } from "../services/api";

export default function Profile() {
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    role: "Administrator",
    status: "Active",
  });
  
  // Password Change State
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [previewImage, setPreviewImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setFormData({
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          department: user.department || "",
          role: user.role || "Administrator",
          status: user.status || "Active",
        });
        if (user.profile_picture) {
          setPreviewImage(getMediaUrl(user.profile_picture));
        }
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordInputChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  // Submit Admin Profile Info & Avatar
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const data = new FormData();
      data.append("name", formData.name);
      data.append("email", formData.email);
      data.append("phone", formData.phone);
      data.append("department", formData.department);
      data.append("role", formData.role);
      data.append("status", formData.status);
      if (selectedFile) {
        data.append("avatar", selectedFile);
      }

      const response = await API.put("/auth/profile", data);
      const result = response.data;

      if (result.user) {
        localStorage.setItem("user", JSON.stringify(result.user));
        setFormData({
          name: result.user.name || "",
          email: result.user.email || "",
          phone: result.user.phone || "",
          department: result.user.department || "",
          role: result.user.role || "Administrator",
          status: result.user.status || "Active",
        });
        if (result.user.profile_picture) {
          setPreviewImage(getMediaUrl(result.user.profile_picture));
        }
        setSelectedFile(null);
        window.dispatchEvent(new Event("userProfileUpdated"));
      }

      setIsSuccess(true);
      setMessage("Admin profile updated successfully!");
    } catch (err) {
      console.error(err);
      setIsSuccess(false);
      setMessage(err.response?.data?.error || err.message || "Error updating profile.");
    } finally {
      setLoading(false);
    }
  };

  // Submit Password Change Separately
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setIsSuccess(false);
      setMessage("New passwords do not match.");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setIsSuccess(false);
      setMessage("New password must be at least 6 characters long.");
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await API.put("/staff/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.data.success) {
        setIsSuccess(true);
        setMessage("Admin password updated successfully!");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    } catch (err) {
      setIsSuccess(false);
      setMessage(err.response?.data?.error || "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "AD";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Single Unified Card Container */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-[#14171f] px-6 py-3.5 text-white flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-xs font-bold tracking-wide">Admin Profile & Security Settings</h1>
            <p className="text-[10px] text-slate-400">Manage your administrative information and password</p>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium">
            {formData.role}
          </span>
        </div>

        <div className="p-5 space-y-4">
          
          {/* Avatar Picker Row */}
          <div className="flex items-center gap-4 bg-slate-50/60 p-3 rounded-2xl border border-slate-100">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            <div className="relative group cursor-pointer shrink-0" onClick={() => fileInputRef.current.click()}>
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-slate-700 to-slate-900 shadow-md flex items-center justify-center text-white text-xs font-bold border-2 border-slate-100">
                {previewImage ? (
                  <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  getInitials(formData.name)
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md border border-white text-[9px] hover:bg-black transition-all">
                📷
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Admin Avatar</p>
              <p className="text-[10px] text-blue-600 font-medium hover:underline cursor-pointer" onClick={() => fileInputRef.current.click()}>
                Click to upload a new profile picture
              </p>
            </div>
          </div>

          {/* Two-Column Layout (Profile Form on Left, Password Form on Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Column 1: Personal Information Form */}
            <form onSubmit={handleProfileSubmit} className="space-y-3 bg-slate-50/40 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <div className="space-y-3">
                <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-200/60">
                  Admin Information
                </h2>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Full Name</label>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">E-mail</label>
                    <input 
                      type="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                      required 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Phone</label>
                    <input 
                      type="text" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleChange}
                      placeholder="+251..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Department</label>
                    <input 
                      type="text" 
                      name="department" 
                      value={formData.department} 
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                      required 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Role</label>
                    <select 
                      name="role" 
                      value={formData.role} 
                      onChange={handleChange}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Administrator">Administrator</option>
                      <option value="Manager">Manager</option>
                      <option value="Staff">Staff</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Status</label>
                    <select 
                      name="status" 
                      value={formData.status} 
                      onChange={handleChange}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Save Profile Button */}
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/10 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Saving Profile..." : "Save Profile"}
                </button>
              </div>
            </form>

            {/* Column 2: Password Security Form */}
            <form onSubmit={handlePasswordSubmit} className="space-y-3 bg-slate-50/40 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <div>
                <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-200/60 mb-3">
                  Security & Password
                </h2>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Current Password</label>
                    <input 
                      type="password" 
                      name="currentPassword" 
                      value={passwordData.currentPassword} 
                      onChange={handlePasswordInputChange}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">New Password</label>
                    <input 
                      type="password" 
                      name="newPassword" 
                      value={passwordData.newPassword} 
                      onChange={handlePasswordInputChange}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Confirm New Password</label>
                    <input 
                      type="password" 
                      name="confirmPassword" 
                      value={passwordData.confirmPassword} 
                      onChange={handlePasswordInputChange}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Update Password Button */}
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={passwordLoading}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/10 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {passwordLoading ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>

          </div>
        </div>
      </div>

      {/* Floating Bottom Notification Banner */}
      {message && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md border ${
          isSuccess 
            ? "bg-slate-900/95 text-emerald-400 border-emerald-500/30" 
            : "bg-slate-900/95 text-rose-400 border-rose-500/30"
        }`}>
          <span className="text-sm">{isSuccess ? "✅" : "⚠️"}</span>
          <span className="text-[11px] font-semibold tracking-wide">{message}</span>
        </div>
      )}
    </div>
  );
}