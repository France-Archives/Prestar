    import {
    ArrowLeftRight, Banknote, Bell, BookMarked, BookOpen, CalendarClock, CalendarDays, ChartColumn,
    Circle, ClipboardList, FileCheck, History, LayoutDashboard, Library, Megaphone, PackageCheck,
    PenLine, Receipt, RefreshCw, Scale, ScrollText, Settings, ShieldAlert, Sparkles, Tags, Undo2,
    User, UserCog, Users, Wrench,
    type LucideIcon,
    } from "lucide-react";
    import { ROUTES } from "@/app/routeConfig";

    // One icon per route. Kept out of routeConfig.ts so the route definitions stay untouched.
    // Keys are the same path strings the sidebar links to, so a missing key just falls back to a dot.
    const S = ROUTES.student;
    const T = ROUTES.staff;
    const A = ROUTES.admin;

    const NAV_ICONS: Record<string, LucideIcon> = {
    // student
    [S.dashboard]: LayoutDashboard,
    [S.books]: BookOpen,
    [S.borrowings]: BookMarked,
    [S.requests]: ClipboardList,
    [S.reservations]: CalendarClock,
    [S.renewals]: RefreshCw,
    [S.history]: History,
    [S.cor]: FileCheck,
    [S.interests]: Sparkles,
    [S.profile]: User,
    [S.notifications]: Bell,
    // librarian / staff
    [T.dashboard]: LayoutDashboard,
    [T.booksToRelease]: PackageCheck,
    [T.requests]: ClipboardList,
    [T.returns]: Undo2,
    [T.reservations]: CalendarClock,
    [T.renewals]: RefreshCw,
    [T.penaltyCheck]: ShieldAlert,
    [T.fines]: Receipt,
    [T.payments]: Banknote,
    [T.corReview]: FileCheck,
    [T.books]: Library,
    [T.categories]: Tags,
    [T.authors]: PenLine,
    [T.maintenance]: Wrench,
    [T.notifications]: Bell,
    // admin
    [A.dashboard]: LayoutDashboard,
    [A.circulation]: ArrowLeftRight,
    [A.reports]: ChartColumn,
    [A.auditLogs]: ScrollText,
    [A.users]: Users,
    [A.librarians]: UserCog,
    [A.cor]: FileCheck,
    [A.books]: Library,
    [A.terms]: CalendarDays,
    [A.policies]: Scale,
    [A.settings]: Settings,
    [A.finesAndPayments]: Banknote,
    [A.notifications]: Megaphone,
    };

    export const iconFor = (path: string): LucideIcon => NAV_ICONS[path] ?? Circle;