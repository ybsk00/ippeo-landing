"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isHospitalLoggedIn,
  getHospitalName,
  hospitalLogout,
} from "@/lib/hospitalApi";
import {
  PeriodProvider,
  usePeriod,
  PERIOD_OPTIONS,
} from "@/lib/hospitalPeriodContext";

// ============================================
// Inner Layout (needs PeriodContext)
// ============================================
function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [hospitalName, setHospitalName] = useState("");
  const { period, setPeriod, periodLabel } = usePeriod();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isHospitalLoggedIn()) {
      router.replace("/hospital/login");
      return;
    }
    setHospitalName(getHospitalName() || "Hospital");
    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center h-screen bg-admin-bg">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-admin-bg flex flex-col">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30">
        {/* Left: Logo + Hospital Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl">
              local_hospital
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-none">
              {hospitalName}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Conversion Dashboard
            </p>
          </div>
        </div>

        {/* Right: Period Selector + Logout */}
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-lg text-slate-500">
                calendar_today
              </span>
              <span className="hidden sm:inline">{periodLabel}</span>
              <span className="material-symbols-outlined text-lg text-slate-400">
                expand_more
              </span>
            </button>
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setPeriod(opt.value);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                        period === opt.value
                          ? "text-primary font-semibold bg-blue-50"
                          : "text-slate-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="h-8 w-[1px] bg-slate-200"></div>

          {/* Logout Button */}
          <button
            onClick={hospitalLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="로그아웃"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

// ============================================
// Layout (wraps with PeriodProvider)
// ============================================
export default function HospitalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PeriodProvider>
      <DashboardShell>{children}</DashboardShell>
    </PeriodProvider>
  );
}
