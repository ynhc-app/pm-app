"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  TrendingUp,
  BarChart3,
  Menu,
  X,
  Building2,
  ShieldCheck,
  Eye,
  KeyRound,
  Loader2,
  LogOut,
  AlertCircle,
  Lock,
} from "lucide-react";

interface SidebarItem {
  name: string;
  shortName?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: SidebarItem[] = [
  { name: "Dashboard", shortName: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { name: "Master RAB", shortName: "RAB", href: "/rab", icon: FileText },
  { name: "Pengeluaran & Transaksi", shortName: "Transaksi", href: "/expenses", icon: Receipt },
  { name: "Monitoring & Kurva-S", shortName: "Monitor", href: "/monitoring", icon: TrendingUp },
  { name: "Laporan", shortName: "Laporan", href: "/reports", icon: BarChart3 },
];

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const { role, isAdmin, loading, loginAdmin, logout } = useAuth();

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPin) return;

    setPinLoading(true);
    setPinError(null);
    try {
      const res = await loginAdmin(adminPin);
      if (!res.success) {
        setPinError(res.message);
        setPinLoading(false);
        return;
      }
      setPinModalOpen(false);
      setAdminPin("");
    } catch (err) {
      console.error(err);
      setPinError("Gagal verifikasi PIN.");
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
        {/* Logo Section */}
        <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-6 dark:border-zinc-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-bold text-zinc-900 dark:text-zinc-50 text-lg tracking-tight">
            BuildTracker
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-xs dark:bg-zinc-50 dark:text-zinc-950"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                }`}
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-105 duration-200 ${
                    isActive ? "text-white dark:text-zinc-950" : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Role Card & Footer */}
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800 space-y-3">
          <div className={`p-3 rounded-xl border ${
            isAdmin
              ? "bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40"
              : "bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${
                isAdmin ? "text-amber-700 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-400"
              }`}>
                {isAdmin ? (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Admin (Akses Penuh)
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 text-blue-500" />
                    Akun Umum (Lihat)
                  </>
                )}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              {isAdmin ? "Bisa input, edit & hapus data" : "Mode pemantau & unduh laporan"}
            </p>

            {isAdmin ? (
              <button
                onClick={() => logout()}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-750 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Mode Tamu
              </button>
            ) : (
              <button
                onClick={() => {
                  setPinError(null);
                  setAdminPin("");
                  setPinModalOpen(true);
                }}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-xs transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Masuk sebagai Admin
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="relative z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white dark:bg-zinc-900 p-6 shadow-xl transition-transform">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-zinc-900 dark:text-zinc-50" />
                <span className="font-bold text-zinc-900 dark:text-zinc-50 text-lg">BuildTracker</span>
              </div>
              <button
                type="button"
                className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <nav className="flex-1 space-y-1.5 mt-6">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Role Switch */}
            <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
              {isAdmin ? (
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold text-zinc-700 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar dari Mode Admin
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setPinError(null);
                    setAdminPin("");
                    setPinModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold text-white bg-amber-600"
                >
                  <KeyRound className="h-4 w-4" />
                  Masuk sebagai Admin
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:pl-64 min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-zinc-200 bg-white/80 backdrop-blur-md px-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/80 md:px-6">
          <button
            type="button"
            className="text-zinc-500 hover:text-zinc-600 md:hidden p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <h1 className="md:hidden text-base font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
            BuildTracker Pro
          </h1>
          
          <div className="flex flex-1 gap-x-4 self-stretch items-center justify-end">
            <div className="flex items-center gap-x-3">
              {/* Role Header Badge */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                isAdmin
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
              }`}>
                {isAdmin ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                    <span className="hidden sm:inline">Peran:</span> Admin
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Peran:</span> Akun Umum (Lihat)
                  </>
                )}
              </div>

              {!isAdmin && (
                <button
                  onClick={() => {
                    setPinError(null);
                    setAdminPin("");
                    setPinModalOpen(true);
                  }}
                  className="hidden sm:inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-xs transition-colors"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  PIN Admin
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Actual Page Render */}
        <main className="flex-1 pt-8 pb-24 md:pb-8 md:py-8 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white px-2 py-2 border-t border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full rounded-lg py-1 transition-colors ${
                isActive
                  ? "text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              <item.icon className={`h-5 w-5 mb-1 ${isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"}`} />
              <span className={`text-[10px] text-center leading-tight tracking-tight ${isActive ? "font-bold" : "font-medium"}`}>
                {item.shortName || item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── Quick PIN Admin Modal ────────────────────────────────────────── */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Masuk sebagai Admin
                </h3>
              </div>
              <button
                onClick={() => setPinModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Masukkan PIN Admin 6-digit untuk mengaktifkan izin Tambah, Edit, Hapus, dan Import data.
              </p>

              {pinError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <input
                  type="password"
                  maxLength={6}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="PIN 6 digit"
                  autoFocus
                  className="w-full text-center tracking-[0.5em] font-mono text-base py-2.5 px-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pinLoading || adminPin.length < 6}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 disabled:opacity-50"
                >
                  {pinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verifikasi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  );
}
