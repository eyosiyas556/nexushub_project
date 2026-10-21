import React from "react";
import { WarningCircle, Trash, LogOut } from "iconoir-react";

/**
 * ConfirmationModal
 * Clean, eye-friendly in-app frontend confirmation dialog.
 * Replaces native browser `window.confirm()` popups.
 */
export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed with this action?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "default", // "default" | "danger" | "release"
  loading = false,
}) {
  if (!isOpen) return null;

  const getIcon = () => {
    if (type === "danger") {
      return (
        <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
          <Trash className="w-5 h-5" />
        </div>
      );
    }
    if (type === "release") {
      return (
        <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0F172A] flex items-center justify-center shrink-0 border border-slate-200/60">
          <LogOut className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0F172A] flex items-center justify-center shrink-0 border border-slate-200/60">
        <WarningCircle className="w-5 h-5" />
      </div>
    );
  };

  const getConfirmButtonClass = () => {
    if (type === "danger") {
      return "bg-rose-600 hover:bg-rose-700 text-white shadow-xs";
    }
    return "bg-[#0F172A] hover:bg-slate-800 text-white shadow-xs";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          {getIcon()}
          <div className="space-y-1 pt-0.5">
            <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 ${getConfirmButtonClass()}`}
          >
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
