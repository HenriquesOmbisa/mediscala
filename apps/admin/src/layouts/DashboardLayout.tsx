import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Receipt,
  LogOut,
  Hospital,
} from "lucide-react";
import { useAuthStore } from "../store/auth.store";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Hospital className="h-7 w-7 text-blue-600" />
            <div>
              <p className="font-bold text-gray-900 text-sm">MediScala</p>
              <p className="text-xs text-gray-500">Painel de Administração</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-900 truncate max-w-[140px]">
                {name ?? "Super Admin"}
              </p>
              <p className="text-xs text-gray-500">SUPER_ADMIN</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
