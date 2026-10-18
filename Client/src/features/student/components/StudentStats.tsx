import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Bell, BookMarked, CalendarClock, Library, PackageCheck, ShieldAlert, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/app/routeConfig";
import type { StudentDashboardData } from "@/types";
import { daysUntil } from "@/utils/formatDate";

interface Tile {
  label: string;
  value: string | number;
  to: string;
  icon: LucideIcon;
  alert?: boolean; // brick red + pulsing dot (overdue only)
  progress?: number; // 0..1, draws a thin bar under the number
}

// Six summary tiles. Same data and links as before, new look.
export default function StudentStats({ data }: { data: StudentDashboardData }) {
  const S = ROUTES.student;
  const overdue = data.activeLoans.filter((l) => daysUntil(l.dueAt) < 0).length;
  const { active, max } = data.commitments;

  const tiles: Tile[] = [
    { label: "Active commitments", value: `${active} / ${max}`, to: S.borrowings, icon: Library, progress: max > 0 ? Math.min(1, active / max) : 0 },
    { label: "Active loans", value: data.activeLoans.length, to: S.borrowings, icon: BookMarked },
    { label: "Waiting for pickup", value: data.pickupWaiting.length, to: S.requests, icon: PackageCheck },
    { label: "Reservations", value: data.reservations.length, to: S.reservations, icon: CalendarClock },
    { label: "Overdue loans", value: overdue, to: S.borrowings, icon: ShieldAlert, alert: overdue > 0 },
    { label: "Unread notices", value: data.unreadCount ?? "—", to: S.notifications, icon: Bell },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t, i) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.label}
            to={t.to}
            // --i staggers the entrance (60ms per tile, see motion.css)
            style={{ "--i": i } as CSSProperties}
            className={`motion-rise motion-lift group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-paper p-4 no-underline hover:no-underline ${
              t.alert ? "border-brick/40" : "border-line-soft"
            }`}
          >
            <span className={`grid h-9 w-9 place-items-center rounded-lg ${t.alert ? "bg-brick-soft text-brick" : "bg-mist text-forest"}`}>
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
            </span>

            <span className={`font-serif text-[1.9rem] font-semibold leading-none tabular-nums ${t.alert ? "text-brick" : "text-heading"}`}>{t.value}</span>

            <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">{t.label}</span>

            {t.progress !== undefined && (
              <span className="h-1.5 overflow-hidden rounded-full bg-mist" aria-hidden="true">
                {/* width is dynamic, so it is the one place an inline style is justified */}
                <span className="block h-full rounded-full bg-green transition-[width] duration-500" style={{ width: `${t.progress * 100}%` }} />
              </span>
            )}

            {/* Not color alone: the dot pulses and screen readers hear it too */}
            {t.alert && (
              <>
                <span className="motion-live absolute right-3 top-3 h-2 w-2 bg-brick text-brick" aria-hidden="true" />
                <span className="sr-only">Needs attention</span>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}