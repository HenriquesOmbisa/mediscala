import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  AlertCircle,
  Shield,
  LogOut,
  Activity,
  ChevronRight,
  CalendarClock,
  UserCircle,
} from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { logoutSession } from "@/lib/auth-session";
import { publicAssetUrl } from "@/lib/public-url";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/dashboard", label: "Visão Geral", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/shifts", label: "Turnos", icon: Calendar },
  { to: "/dashboard/coverage", label: "Cobertura", icon: Shield },
  { to: "/dashboard/leave-requests", label: "Pedidos", icon: CalendarClock },
  { to: "/dashboard/absences", label: "Faltas", icon: AlertCircle },
  { to: "/dashboard/users", label: "Utilizadores", icon: Users },
  { to: "/dashboard/departments", label: "Departamentos", icon: Building2 },
];

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HOSPITAL_ADMIN: "Administrador",
  MANAGER: "Gestor",
  COLLABORATOR: "Colaborador",
};

const roleBadgeClass: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  HOSPITAL_ADMIN: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  MANAGER: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  COLLABORATOR: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export function DashboardLayout() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useWebSocket({
    notification: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    coverage_request: () => queryClient.invalidateQueries({ queryKey: ["coverage"] }),
    coverage_filled: () => queryClient.invalidateQueries({ queryKey: ["coverage"] }),
    shift_updated: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["coverage"] });
    },
  });

  const handleLogout = async () => {
    await logoutSession();
    navigate({ to: "/login" });
  };

  const initials = user?.name
    ?.split(" ")
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() ?? "U";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* ── Sidebar ───────────────────────────────────────── */}
        <aside className="w-[240px] bg-[#0B1F3A] flex flex-col shrink-0">
          {/* Logo */}
          <div className="px-5 py-5 flex items-center gap-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-teal-400/15 border border-teal-400/20 flex items-center justify-center shrink-0">
              <Activity size={16} className="text-teal-400" />
            </div>
            <div>
              <p className="text-base font-bold text-white leading-none">
                Medi<span className="text-teal-400">Scala</span>
              </p>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase mt-0.5">
                Escalas · Equipa
              </p>
            </div>
          </div>

          {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-4">
                Navegação
              </p>
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: to === "/dashboard" }}
                  className="group flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] text-slate-400 hover:text-white hover:bg-white/5 transition-all [&.active]:bg-teal-400/10 [&.active]:text-teal-300 [&.active]:font-medium"
                >
                <Icon size={18} className="shrink-0" />
                <span className="flex-1">{label}</span>
                <ChevronRight
                  size={13}
                  className="opacity-0 group-[&.active]:opacity-100 text-teal-400 transition-opacity"
                />
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-white/5">
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all text-left group outline-none border-0 bg-transparent text-[inherit] cursor-pointer"
              >
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage
                      src={
                        publicAssetUrl(user?.avatarUrl ?? undefined) ??
                        undefined
                      }
                      alt=""
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-teal-400/20 text-teal-300 text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate leading-none mb-1">
                      {user?.name}
                    </p>
                    <span
                      className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                        roleBadgeClass[user?.role ?? ""] ?? roleBadgeClass.COLLABORATOR
                      }`}
                    >
                      {roleLabel[user?.role ?? ""] ?? user?.role}
                    </span>
                  </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-52 rounded-xl shadow-xl"
              >
                <DropdownMenuLabel className="font-normal">
                  <p className="font-semibold text-sm text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer"
                  onClick={() => navigate({ to: "/dashboard/profile" })}
                >
                  <UserCircle size={14} className="mr-2" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50 rounded-lg cursor-pointer"
                >
                  <LogOut size={14} className="mr-2" />
                  Terminar sessão
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
  );
}