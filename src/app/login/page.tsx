"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAsAdmin, loginAsViewer } from "@/app/actions/auth";
import {
  ShieldCheck,
  Eye,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  Building2,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"VIEWER" | "ADMIN">("VIEWER");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleViewerLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await loginAsViewer();
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal masuk. Silakan coba lagi.");
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setErrorMsg("Silakan masukkan PIN Admin.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await loginAsAdmin(pin);
      if (!res.success) {
        setErrorMsg(res.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMsg("Terjadi kesalahan saat verifikasi PIN.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 py-12">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-8 z-10">
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl mb-2">
            <Building2 className="h-8 w-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            BuildTracker Pro
          </h1>
          <p className="text-xs text-zinc-400">
            Sistem Manajemen Proyek, RAB, &amp; Kurva-S Konstruksi
          </p>
        </div>

        {/* Role Toggle Selector */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-zinc-900 border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setSelectedRole("VIEWER");
              setErrorMsg(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              selectedRole === "VIEWER"
                ? "bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Eye className="h-4 w-4 text-blue-400" />
            Akun Umum (Tamu)
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedRole("ADMIN");
              setErrorMsg(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              selectedRole === "ADMIN"
                ? "bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            Akun Admin
          </button>
        </div>

        {/* Main Card Form */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-950/50 border border-rose-900/50 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {selectedRole === "VIEWER" ? (
            /* Viewer (Public) Card */
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="h-4 w-4" />
                  Akses Hanya Lihat (Read-Only)
                </div>
                <h2 className="text-base font-bold text-white">
                  Masuk sebagai Tamu / Publik
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Dapat melihat seluruh progres proyek, struktur RAB, kurva S, ringkasan pengeluaran, serta mengunduh dokumen laporan tanpa perlu memasukkan PIN.
                </p>
              </div>

              <div className="space-y-2 rounded-xl bg-zinc-950/60 p-4 border border-zinc-800/80 text-xs text-zinc-400 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-300">
                  <span className="text-emerald-400">✓</span> Pantau Dashboard &amp; Keuangan
                </div>
                <div className="flex items-center gap-2 text-zinc-300">
                  <span className="text-emerald-400">✓</span> Lihat Master RAB &amp; AHSP
                </div>
                <div className="flex items-center gap-2 text-zinc-300">
                  <span className="text-emerald-400">✓</span> Unduh Laporan Excel &amp; PDF
                </div>
              </div>

              <button
                type="button"
                onClick={handleViewerLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    Masuk Sekarang
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Admin Card */
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <Lock className="h-4 w-4" />
                  Akses Penuh Pengelola
                </div>
                <h2 className="text-base font-bold text-white">
                  Masuk sebagai Admin Proyek
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Masukkan PIN 6-digit untuk mengaktifkan izin Input Transaksi, Edit/Hapus RAB, Import Excel, dan Update Progres Mingguan.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300">
                  PIN Keamanan Admin
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Masukkan 6 digit PIN"
                    autoFocus
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 py-3 text-sm font-mono text-center tracking-[0.5em] text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:tracking-normal placeholder:font-sans placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || pin.length < 6}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold shadow-lg shadow-amber-900/20 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    Masuk sebagai Admin
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-zinc-600">
          BuildTracker &copy; {new Date().getFullYear()} • Secure Project Management
        </div>
      </div>
    </div>
  );
}
