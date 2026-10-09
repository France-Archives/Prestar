import { useLocation, useNavigate } from "react-router-dom";
import Logo from "./Logo";
import { useAuthedLibrary } from "../context/LibraryContext";
import { HOME_BY_ROLE, NAV } from "../utils/constants";

type DrawerProps = { open: boolean; onClose: () => void; onSignOut: () => void };

// Role-based sidebar: only the current role's pages are listed.
export default function Drawer({ open, onClose, onSignOut }: DrawerProps) {
  const { user } = useAuthedLibrary();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <>
      <div
        className={`scrim fixed inset-0 z-[80] bg-[#07352C]/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          open ? "show pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`drawer fixed left-0 top-0 z-[90] flex h-full w-[86vw] max-w-[320px] flex-col overflow-y-auto border-r border-[#D9DDD7] bg-[#F5F3EA] shadow-[18px_0_44px_rgba(7,53,44,0.18)] transition-transform duration-300 ease-[cubic-bezier(.22,.8,.3,1)] ${
          open ? "open translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="drawer-top flex items-center justify-between gap-3 border-b border-[#D9DDD7] px-5 py-4">
          <div className="min-w-0 font-serif text-[#0B3D32]">
            <Logo onClick={() => navigate(HOME_BY_ROLE[user.role])} />
          </div>
          <button
            className="icon-btn grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[16px] text-[#0B3D32] transition-colors duration-200 hover:bg-[#DCE5D7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]"
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="drawer-user mx-4 mt-5 flex flex-col gap-0.5 rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] px-4 py-3.5 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
          <strong className="truncate font-serif text-[17px] font-medium text-[#0B3D32]">
            {user.first_name} {user.last_name}
          </strong>
          <span className="truncate font-sans text-[12px] text-[#6B756F]">{user.email}</span>
        </div>

        <nav className="mt-5 flex flex-1 flex-col gap-1.5 px-4">
          {NAV[user.role].map(({ to, label }) => {
            const active = pathname === to;
            return (
              <button
                key={to}
                className={`${active ? "active" : ""} flex w-full items-center rounded-[10px] px-4 py-3 text-left font-sans text-[14px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
                  active
                    ? "bg-[#0B3D32] text-white shadow-[0_6px_14px_rgba(11,61,50,0.22)]"
                    : "text-[#1F2A27] hover:bg-[#DCE5D7] hover:text-[#0B3D32]"
                }`}
                onClick={() => navigate(to)}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#D9DDD7] bg-[#FBFAF5] p-4">
          <button
            className="signout flex h-11 w-full items-center justify-center rounded-[10px] bg-[#B98A4A] font-sans text-[13px] font-bold tracking-[0.04em] text-white transition-all duration-200 hover:bg-[#a67a3f] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]"
            onClick={onSignOut}
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}