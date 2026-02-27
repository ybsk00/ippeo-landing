"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  hospitalAPI,
  saveHospitalAuth,
  isHospitalLoggedIn,
} from "@/lib/hospitalApi";

export default function HospitalLoginPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isHospitalLoggedIn()) {
      router.replace("/hospital/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("API 키를 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const result = await hospitalAPI.login(trimmed);
      saveHospitalAuth(result.token, result.hospital.name);
      router.replace("/hospital/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "로그인에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md mx-4">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <span className="material-symbols-outlined text-white text-3xl">
              local_hospital
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">Hospital Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            ARUMI Conversion Analytics
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl p-8 space-y-5"
        >
          <div className="text-center mb-2">
            <h2 className="text-lg font-bold text-slate-800">API Key Login</h2>
            <p className="text-slate-500 text-xs mt-1">
              발급받으신 API 키를 입력해주세요
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="hp_xxxxxxxxxxxxxxxx"
                autoFocus
                className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-xl">
                  {showKey ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            로그인
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-6">
          &copy; 2026 ARUMI. All rights reserved.
        </p>
      </div>
    </div>
  );
}
