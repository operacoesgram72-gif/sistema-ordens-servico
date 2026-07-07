import { createContext, useContext, useState } from "react";

export type Unit = "AM" | "AC" | "AP" | "RO" | "RR" | "PA";

export const UNITS: { key: Unit; label: string; name: string }[] = [
  { key: "AM", label: "AM", name: "Amazonas" },
  { key: "AC", label: "AC", name: "Acre" },
  { key: "AP", label: "AP", name: "Amapá" },
  { key: "RO", label: "RO", name: "Rondônia" },
  { key: "RR", label: "RR", name: "Roraima" },
  { key: "PA", label: "PA", name: "Pará" },
];

type UnitContextValue = {
  unit: Unit;
  setUnit: (unit: Unit) => void;
  /** When true, the unit is locked and setUnit is a no-op */
  locked: boolean;
};

const UnitContext = createContext<UnitContextValue>({
  unit: "AM",
  setUnit: () => {},
  locked: false,
});

interface UnitProviderProps {
  children: React.ReactNode;
  /** When provided, locks the unit to this value and disables switching */
  lockedUnit?: Unit | null;
}

export function UnitProvider({ children, lockedUnit }: UnitProviderProps) {
  const [unit, setUnitState] = useState<Unit>(() => {
    if (lockedUnit) return lockedUnit;
    try {
      return (localStorage.getItem("selectedUnit") as Unit) || "AM";
    } catch {
      return "AM";
    }
  });

  const locked = Boolean(lockedUnit);

  const setUnit = (u: Unit) => {
    if (locked) return; // No-op when locked
    try { localStorage.setItem("selectedUnit", u); } catch {}
    setUnitState(u);
  };

  return (
    <UnitContext.Provider value={{ unit: locked ? lockedUnit! : unit, setUnit, locked }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  return useContext(UnitContext);
}
