/**
 * ShareContext
 *
 * Reads share params from the URL: ?share=<UNIT>&t=<TOKEN>
 * When present:
 *  - Exposes shareUnit and shareToken to consumers
 *  - Calls setExtraHeaders() on the API client to inject X-Share-Token on every request
 *  - The backend validates the token and enforces unit-based data restrictions
 *
 * AM share: user can browse all units (UF filter available)
 * Non-AM share: unit is locked to the share unit
 */
import { createContext, useContext, useEffect, useMemo } from "react";
import { setExtraHeaders } from "@workspace/api-client-react";

export type ShareContextValue = {
  isShareMode: boolean;
  shareUnit: string | null;  // e.g. "AM", "AC", etc. — null if not a share session
  isAMShare: boolean;        // true when shareUnit === "AM" (full access)
};

const ShareContext = createContext<ShareContextValue>({
  isShareMode: false,
  shareUnit: null,
  isAMShare: false,
});

function parseShareParams(): { unit: string | null; token: string | null } {
  try {
    const params = new URLSearchParams(window.location.search);
    const unit = params.get("share");
    const token = params.get("t");
    if (unit && token && token.length === 48) {
      return { unit: unit.toUpperCase(), token };
    }
  } catch {
    // ignore
  }
  return { unit: null, token: null };
}

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const { unit, token } = useMemo(parseShareParams, []);

  const value: ShareContextValue = useMemo(() => ({
    isShareMode: Boolean(unit && token),
    shareUnit: unit,
    isAMShare: unit === "AM",
  }), [unit, token]);

  // Inject the share token as a custom header into every API call
  useEffect(() => {
    if (unit && token) {
      setExtraHeaders({ "x-share-token": token });
    }
    return () => {
      // Clean up on unmount (e.g. if share mode is removed)
      setExtraHeaders({});
    };
  }, [unit, token]);

  return (
    <ShareContext.Provider value={value}>
      {children}
    </ShareContext.Provider>
  );
}

export function useShare(): ShareContextValue {
  return useContext(ShareContext);
}
