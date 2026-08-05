import { ArrowDown, Minus, ArrowUp, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export type Priority = "baixa" | "media" | "alta" | "urgente";

// Reuses the same text color already defined in PRIORITY_COLORS (lib/constants.ts)
// for each priority level — no new palette colors introduced, just an icon glyph
// added alongside the existing color convention.
const PRIORITY_ICONS: Record<Priority, typeof ArrowDown> = {
  baixa: ArrowDown,
  media: Minus,
  alta: ArrowUp,
  urgente: Flame,
};

const PRIORITY_ICON_COLOR: Record<Priority, string> = {
  baixa: "text-emerald-500",
  media: "text-yellow-500",
  alta: "text-orange-500",
  urgente: "text-red-500",
};

export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const key = (priority as Priority) in PRIORITY_ICONS ? (priority as Priority) : "media";
  const Icon = PRIORITY_ICONS[key];
  return <Icon className={cn("shrink-0", PRIORITY_ICON_COLOR[key], className)} />;
}
