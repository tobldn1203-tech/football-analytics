import { Gauge, Activity, Target, Sparkles, ArrowUpRight, Shield, Zap, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/analytics/scoring/types";

/** One coherent icon family for category navigation — see design notes in top-performers.tsx. */
export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  overall: Gauge,
  form: Activity,
  attack: Target,
  creation: Sparkles,
  progression: ArrowUpRight,
  defence: Shield,
  impact: Zap,
};
