"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// ============================================
// Period Context for Hospital Dashboard
// ============================================
export type Period = "month" | "last_month" | "all";

interface PeriodContextType {
  period: Period;
  setPeriod: (p: Period) => void;
  periodLabel: string;
}

const PeriodContext = createContext<PeriodContextType>({
  period: "month",
  setPeriod: () => {},
  periodLabel: "이번 달",
});

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "month", label: "이번 달" },
  { value: "last_month", label: "지난 달" },
  { value: "all", label: "전체 기간" },
];

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>("month");

  const periodLabel =
    PERIOD_OPTIONS.find((o) => o.value === period)?.label || "이번 달";

  return (
    <PeriodContext.Provider value={{ period, setPeriod, periodLabel }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  return useContext(PeriodContext);
}
