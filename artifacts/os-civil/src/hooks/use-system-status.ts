import { useQuery } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface SystemStatus {
  active: boolean;
  /** True when the action/toggle password has been configured */
  passwordSet: boolean;
  /** True when the module-level access password has been configured */
  modulePasswordSet: boolean;
}

/**
 * Fetches the global system active/inactive state from the backend.
 * Fails open (active = true) so a network error never locks users out.
 * Refreshes every 30 s so the registrar pages stay in sync.
 */
export function useSystemStatus() {
  const { data, isLoading } = useQuery<SystemStatus>({
    queryKey: ["system-status"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/system-status`);
      if (!res.ok) return { active: true, passwordSet: false, modulePasswordSet: false };
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  return {
    systemActive: data?.active ?? true,
    passwordSet: data?.passwordSet ?? false,
    modulePasswordSet: data?.modulePasswordSet ?? false,
    isLoading,
  };
}
