import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  CreditCard,
  Package,
  Receipt,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "../store/auth.store";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/tenants", icon: Building2, label: "Empresas" },
  { to: "/plans", icon: Package, label: "Planos" },
  { to: "/subscriptions", icon: CreditCard, label: "Subscrições" },
  { to: "/payments", icon: Receipt, label: "Pagamentos" },
];

export default function DashboardLayout() {
  const logout = useAuthStore((s) => s.logout);
  const name = useAuthStore((s) => s.name);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#0B1F3A] flex flex-col">
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <img src="/logo-dark.png" alt="MediScala" className="w-8 h-8 object-contain" />
            <div>
              <p className="text-base font-bold text-white leading-none">
                Medi<span className="text-teal-400">Scala</span>
              </p>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase mt-0.5">Administração</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] transition-all ${
                  isActive
                    ? "bg-teal-400/10 text-teal-300 font-medium"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white truncate max-w-[140px]">
                {name ?? "Super Admin"}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">SUPER_ADMIN</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-300 hover:bg-red-500/15 rounded-md transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
