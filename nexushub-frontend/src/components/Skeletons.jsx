import React from "react";

// Reusable Skeleton Pulse Block
export const SkeletonPulse = ({ className = "" }) => (
  <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
);

// Generic Fallback Skeleton used by Suspense in App.jsx
export const GenericPageSkeleton = () => (
  <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <SkeletonPulse className="h-7 w-48 sm:w-64 rounded-xl" />
        <SkeletonPulse className="h-4 w-72 sm:w-96 rounded-lg" />
      </div>
      <SkeletonPulse className="h-10 w-32 rounded-xl" />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <SkeletonPulse className="h-3 w-20" />
            <SkeletonPulse className="h-6 w-14 rounded-lg" />
          </div>
          <SkeletonPulse className="w-11 h-11 rounded-xl shrink-0" />
        </div>
      ))}
    </div>

    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
      <SkeletonPulse className="h-5 w-40 rounded-lg" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonPulse key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);

// Admin Operations Dashboard Skeleton
export const DashboardSkeleton = () => (
  <div className="text-[#0F172A] p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
    {/* Header Banner Skeleton */}
    <div className="bg-slate-900/90 px-5 py-5 sm:px-6 sm:py-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-48 sm:w-60 bg-slate-700 rounded-xl" />
        <div className="h-3.5 w-72 sm:w-96 bg-slate-800 rounded-lg" />
      </div>
      <div className="h-7 w-24 bg-slate-800 rounded-full" />
    </div>

    {/* 6 Metric Cards Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-2.5 flex-1 mr-4">
            <SkeletonPulse className="h-3 w-28" />
            <SkeletonPulse className="h-8 w-16 rounded-xl" />
          </div>
          <SkeletonPulse className="w-12 h-12 rounded-xl shrink-0" />
        </div>
      ))}
    </div>

    {/* Lower Section: Activity Feed & Side Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
      {/* Activity Feed Placeholder */}
      <div className="lg:col-span-2 bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex justify-between items-center mb-2">
          <SkeletonPulse className="h-5 w-52 rounded-lg" />
          <SkeletonPulse className="h-7 w-24 rounded-xl" />
        </div>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50/70 border border-gray-100">
              <SkeletonPulse className="w-9 h-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <SkeletonPulse className="h-3.5 w-32" />
                  <SkeletonPulse className="h-3 w-16" />
                </div>
                <SkeletonPulse className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Chart Cards Placeholder */}
      <div className="flex flex-col space-y-4">
        {[1, 2].map((box) => (
          <div key={box} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm space-y-3">
            <div className="space-y-1">
              <SkeletonPulse className="h-4 w-36 rounded-lg" />
              <SkeletonPulse className="h-2.5 w-24 rounded-md" />
            </div>
            <SkeletonPulse className="h-24 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <SkeletonPulse className="h-5 w-full rounded-md" />
              <SkeletonPulse className="h-5 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Staff Dashboard Skeleton
export const StaffDashboardSkeleton = () => (
  <div className="space-y-6 max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 text-[#0F172A]">
    {/* Header Banner Skeleton */}
    <div className="bg-slate-900/90 px-6 py-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-44 bg-slate-700 rounded-xl" />
        <div className="h-3.5 w-72 bg-slate-800 rounded-lg" />
      </div>
      <div className="h-7 w-28 bg-slate-800 rounded-full" />
    </div>

    {/* 4 Metrics Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-2 flex-1 mr-3">
            <SkeletonPulse className="h-3 w-24" />
            <SkeletonPulse className="h-7 w-12 rounded-xl" />
          </div>
          <SkeletonPulse className="w-10 h-10 rounded-xl shrink-0" />
        </div>
      ))}
    </div>

    {/* 2 Main Panels */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2].map((col) => (
        <div key={col} className="bg-white border border-gray-100 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4">
          <SkeletonPulse className="h-5 w-44 rounded-lg" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="p-4 bg-slate-50/70 border border-gray-100 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <SkeletonPulse className="h-4 w-36" />
                  <SkeletonPulse className="h-5 w-16 rounded-full" />
                </div>
                <SkeletonPulse className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Standard Table / Directory / Management Page Skeleton
// (Used for Members, Resources, Requests, Staff Requests, Staff Resources, Assigned Requests)
export const TablePageSkeleton = ({
  titleWidth = "w-48",
  hasCreateButton = true,
  filterCount = 3,
  rowCount = 6,
}) => (
  <div className="text-[#0F172A] p-3 sm:p-6 lg:p-8">
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <SkeletonPulse className={`h-8 ${titleWidth} rounded-xl`} />
          <SkeletonPulse className="h-3.5 w-64 sm:w-96 rounded-lg" />
        </div>
        {hasCreateButton && (
          <SkeletonPulse className="h-10 w-36 rounded-xl self-start sm:self-auto shrink-0" />
        )}
      </div>

      {/* Filter Bar Skeleton */}
      <div className={`bg-white border border-gray-100 p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-${filterCount} gap-4`}>
        {Array.from({ length: filterCount }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <SkeletonPulse className="h-2.5 w-20" />
            <SkeletonPulse className="h-9 w-full rounded-xl" />
          </div>
        ))}
      </div>

      {/* Table / List Container Skeleton */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header Placeholder */}
        <div className="p-4 bg-slate-50/70 border-b border-gray-100 hidden sm:flex justify-between gap-4">
          <SkeletonPulse className="h-3.5 w-1/4" />
          <SkeletonPulse className="h-3.5 w-1/6" />
          <SkeletonPulse className="h-3.5 w-1/6" />
          <SkeletonPulse className="h-3.5 w-1/6" />
          <SkeletonPulse className="h-3.5 w-16" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100">
          {Array.from({ length: rowCount }).map((_, i) => (
            <div key={i} className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <SkeletonPulse className="w-9 h-9 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <SkeletonPulse className="h-3.5 w-36 sm:w-48" />
                  <SkeletonPulse className="h-2.5 w-24 sm:w-32" />
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-6 justify-between sm:justify-end">
                <SkeletonPulse className="h-6 w-20 rounded-full" />
                <SkeletonPulse className="h-6 w-16 rounded-full" />
                <SkeletonPulse className="h-7 w-16 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
