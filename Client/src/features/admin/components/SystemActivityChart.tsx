import type { AdminDashboardData, BookCopyStatus } from "@/types";
import { ActivityChart as ActivityVisualization, DonutChart } from "@/features/dashboard/DashboardVisuals";

type Day = AdminDashboardData["activityLast7Days"][number];

export function ActivityChart({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: Day[] | null;
  selectedDay: string | null;
  onSelectDay: (date: string) => void;
}) {
  return <ActivityVisualization days={days} selectedDay={selectedDay} onSelectDay={onSelectDay} />;
}

export function CopyStatusBars({ counts }: { counts: Record<BookCopyStatus, number> | null }) {
  return <DonutChart counts={counts} />;
}

export { CopyStatusBars as CopyStatusDonut };