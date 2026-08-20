"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_PIN = "110693";
const AUTH_COOKIE_NAME = "buildtracker_role";

export type UserRole = "ADMIN" | "VIEWER";

/**
 * Get the current user's role from session cookie.
 */
export async function getCurrentRole(): Promise<UserRole> {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (roleCookie === "ADMIN") {
    return "ADMIN";
  }

  // Default to VIEWER if not logged in as ADMIN
  return "VIEWER";
}

/**
 * Validate PIN and login as ADMIN.
 */
export async function loginAsAdmin(pin: string) {
  if (pin.trim() !== ADMIN_PIN) {
    return {
      success: false,
      message: "PIN Admin salah. Silakan coba lagi.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "ADMIN", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });

  return {
    success: true,
    message: "Berhasil masuk sebagai Admin.",
  };
}

/**
 * Login as public / guest VIEWER without PIN.
 */
export async function loginAsViewer() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "VIEWER", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });

  return {
    success: true,
    message: "Berhasil masuk sebagai Akun Umum (Hanya Lihat).",
  };
}

/**
 * Logout / reset to VIEWER.
 */
export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect("/login");
}

/**
 * Helper to throw an error if the user is not ADMIN.
 */
export async function requireAdmin() {
  const role = await getCurrentRole();
  if (role !== "ADMIN") {
    throw new Error("Akses Ditolak: Hanya Akun Admin yang diizinkan untuk mengubah data.");
  }
}
