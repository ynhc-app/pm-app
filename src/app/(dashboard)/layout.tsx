"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  TrendingUp,
  BarChart3,
  Menu,
  X,
  Building2,
  User,
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

        {/* User Profile Footer */}
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 truncate">Project Manager</p>
              <p className="text-[10px] text-zinc-500 truncate dark:text-zinc-400">pm@buildtracker.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer (Overlay and Menu) */}
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
          
          <h1 className="md:hidden text-lg font-extrabold text-emerald-600 dark:text-emerald-500 tracking-tight truncate">
            Proyek Gedung TPA
          </h1>
          
          <div className="flex flex-1 gap-x-4 self-stretch items-center justify-end">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Notification icon / Dark mode / Info */}
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline-flex text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1 rounded-sm">
                  Aktif: Pembangunan Gedung TPA Nurul Hikmah
                </span>
              </div>
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
    </div>
  );
}
