import type { AdminDashboardData, BookCopyStatus } from "@/types";
import { ActivityChart as ActivityVisualization, DonutChart } from "@/features/dashboard/DashboardVisuals";

type Day = AdminDashboardData["activityLast7Days"][number];

export function ActivityChart({
  days,
  selectedDay,
  onSelectDay,
  formatBucket,
}: {
  days: Day[] | null;
  selectedDay: string | null;
  onSelectDay: (date: string) => void;
  formatBucket?: (date: string) => string;
}) {
  return <ActivityVisualization days={days} selectedDay={selectedDay} onSelectDay={onSelectDay} formatBucket={formatBucket} />;
}

export function CopyStatusBars({ counts }: { counts: Record<BookCopyStatus, number> | null }) {
  return <DonutChart counts={counts} />;
}

export { CopyStatusBars as CopyStatusDonut };