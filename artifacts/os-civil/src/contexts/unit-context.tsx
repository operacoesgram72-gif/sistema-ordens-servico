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
};

const UnitContext = createContext<UnitContextValue>({
  unit: "AM",
  setUnit: () => {},
});

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnitState] = useState<Unit>(() => {
    try {
      return (localStorage.getItem("selectedUnit") as Unit) || "AM";
    } catch {
      return "AM";
    }
  });

  const setUnit = (u: Unit) => {
    try { localStorage.setItem("selectedUnit", u); } catch {}
    setUnitState(u);
  };

  return (
    <UnitContext.Provider value={{ unit, setUnit }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  return useContext(UnitContext);
}
