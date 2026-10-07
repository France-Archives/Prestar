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
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="drawer-top">
          <Logo onClick={() => navigate(HOME_BY_ROLE[user.role])} />
          <button className="icon-btn" onClick={onClose} aria-label="Close menu">✕</button>
        </div>
        <div className="drawer-user"><strong>{user.first_name} {user.last_name}</strong><span>{user.email}</span></div>
        <nav>
          {NAV[user.role].map(({ to, label }) => (
            <button key={to} className={pathname === to ? "active" : ""} onClick={() => navigate(to)}>{label}</button>
          ))}
        </nav>
        <button className="signout" onClick={onSignOut}>Sign Out</button>
      </aside>
    </>
  );
}