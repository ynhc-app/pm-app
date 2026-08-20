"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getCurrentRole, loginAsAdmin, loginAsViewer, logoutUser, UserRole } from "@/app/actions/auth";

interface AuthContextType {
  role: UserRole;
  isAdmin: boolean;
  loading: boolean;
  refreshRole: () => Promise<void>;
  loginAdmin: (pin: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  role: "VIEWER",
  isAdmin: false,
  loading: true,
  refreshRole: async () => {},
  loginAdmin: async () => ({ success: false, message: "" }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("VIEWER");
  const [loading, setLoading] = useState(true);

  const refreshRole = async () => {
    try {
      const current = await getCurrentRole();
      setRole(current);
    } catch (err) {
      console.error("Error fetching auth role:", err);
      setRole("VIEWER");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshRole();
  }, []);

  const loginAdmin = async (pin: string) => {
    const res = await loginAsAdmin(pin);
    if (res.success) {
      setRole("ADMIN");
    }
    return res;
  };

  const logout = async () => {
    await loginAsViewer();
    setRole("VIEWER");
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        isAdmin: role === "ADMIN",
        loading,
        refreshRole,
        loginAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
