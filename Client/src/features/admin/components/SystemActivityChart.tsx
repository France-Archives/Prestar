import type { AdminDashboardData, BookCopyStatus } from "@/types";
import { ActivityChart as ActivityVisualization, DonutChart } from "@/features/dashboard/DashboardVisuals";

type Day = AdminDashboardData["activityLast7Days"][number];

export function ActivityChart({ days }: { days: Day[] | null }) {
  return <ActivityVisualization days={days} />;
}

export function CopyStatusBars({ counts }: { counts: Record<BookCopyStatus, number> | null }) {
  return <DonutChart counts={counts} />;
}

export { CopyStatusBars as CopyStatusDonut };