const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// ============================================
// Hospital Auth Helpers
// ============================================
const HOSPITAL_TOKEN_KEY = "hospital_token";
const HOSPITAL_NAME_KEY = "hospital_name";

export function saveHospitalAuth(token: string, hospitalName: string) {
  localStorage.setItem(HOSPITAL_TOKEN_KEY, token);
  localStorage.setItem(HOSPITAL_NAME_KEY, hospitalName);
}

export function getHospitalToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(HOSPITAL_TOKEN_KEY);
}

export function getHospitalName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(HOSPITAL_NAME_KEY);
}

export function isHospitalLoggedIn(): boolean {
  const token = getHospitalToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearHospitalAuth();
      return false;
    }
    return true;
  } catch {
    clearHospitalAuth();
    return false;
  }
}

export function clearHospitalAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HOSPITAL_TOKEN_KEY);
  localStorage.removeItem(HOSPITAL_NAME_KEY);
}

export function hospitalLogout() {
  clearHospitalAuth();
  window.location.href = "/hospital/login";
}

// ============================================
// Fetch Wrapper
// ============================================
async function fetchHospitalAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getHospitalToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearHospitalAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/hospital/login";
    }
    throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.detail || `API Error: ${res.status} ${res.statusText}`
    );
  }

  return res.json();
}

// ============================================
// Type Definitions
// ============================================
export interface Hospital {
  id: string;
  name: string;
  slug: string;
  category: "dermatology" | "plastic_surgery";
  created_at: string;
}

export interface HospitalStats {
  period: string;
  total_reports: number;
  total_views: number;
  total_clicks: number;
  total_inquiries: number;
  total_bookings: number;
  view_rate: number;
  click_rate: number;
  inquiry_rate: number;
  booking_rate: number;
  funnel: FunnelStep[];
  daily_trend: { date: string; reports: number; views: number; clicks: number }[];
}

export interface FunnelStep {
  name: string;
  name_ja: string;
  count: number;
  rate: number;
  color: string;
}

export interface HospitalReport {
  id: string;
  consultation_id: string;
  customer_name_masked: string;
  classification: "dermatology" | "plastic_surgery" | null;
  procedure_keywords: string[];
  status: "draft" | "approved" | "sent";
  viewed: boolean;
  viewed_at: string | null;
  cta_level: "hot" | "warm" | "cool" | null;
  created_at: string;
}

export interface ReportList {
  data: HospitalReport[];
  total: number;
  page: number;
  page_size: number;
}

export interface HospitalSession {
  id: string;
  customer_name_masked: string;
  event_type: string;
  referrer: string | null;
  created_at: string;
}

export interface SessionList {
  data: HospitalSession[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================
// Hospital API Client
// ============================================
export const hospitalAPI = {
  login: (apiKey: string) =>
    fetchHospitalAPI<{ token: string; hospital: Hospital }>(
      "/hospital/login",
      {
        method: "POST",
        body: JSON.stringify({ api_key: apiKey }),
      }
    ),

  stats: (period?: string) => {
    const query = period ? `?period=${period}` : "";
    return fetchHospitalAPI<HospitalStats>(`/hospital/stats${query}`);
  },

  reports: (page?: number) => {
    const query = page ? `?page=${page}` : "";
    return fetchHospitalAPI<ReportList>(`/hospital/reports${query}`);
  },

  sessions: (page?: number) => {
    const query = page ? `?page=${page}` : "";
    return fetchHospitalAPI<SessionList>(`/hospital/sessions${query}`);
  },
};
