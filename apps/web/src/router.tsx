import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { Root } from "./pages/Root";
import { LoginPage } from "./pages/auth/LoginPage";
import { DashboardLayout } from "./pages/dashboard/DashboardLayout";
import { DashboardHome } from "./pages/dashboard/DashboardHome";
import { UsersPage } from "./pages/dashboard/UsersPage";
import { DepartmentsPage } from "./pages/dashboard/DepartmentsPage";
import { ShiftsPage } from "./pages/dashboard/ShiftsPage";
import { CoveragePage } from "./pages/dashboard/CoveragePage";
import { AbsencesPage } from "./pages/dashboard/AbsencesPage";
import { LeaveRequestsPage } from "./pages/dashboard/LeaveRequestsPage";
import { ProfilePage } from "./pages/dashboard/ProfilePage";
import { InstitutionPage } from "./pages/dashboard/InstitutionPage";
import { BillingPlanPage } from "./pages/dashboard/BillingPlanPage";
import { BillingPaymentsPage } from "./pages/dashboard/BillingPaymentsPage";
import { BillingUpgradePage } from "./pages/dashboard/BillingUpgradePage";
import { useAuthStore } from "./store/auth.store";

const rootRoute = createRootRoute({ component: Root });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
  beforeLoad: () => {
    const { user } = useAuthStore.getState();
    if (user && ["HOSPITAL_ADMIN", "MANAGER"].includes(user.role)) {
      throw redirect({ to: "/dashboard" });
    }
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardLayout,
  beforeLoad: () => {
    const { user } = useAuthStore.getState();
    if (!user) throw redirect({ to: "/login" });
    if (!["HOSPITAL_ADMIN", "MANAGER"].includes(user.role)) {
      throw redirect({ to: "/login" });
    }
  },
});

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/",
  component: DashboardHome,
});

const profileRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/profile",
  component: ProfilePage,
});

const institutionRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/institution",
  component: InstitutionPage,
  beforeLoad: () => {
    const { user } = useAuthStore.getState();
    if (!user || !["HOSPITAL_ADMIN", "MANAGER"].includes(user.role)) {
      throw redirect({ to: "/dashboard" });
    }
  },
});

const usersRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/users",
  component: UsersPage,
});

const departmentsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/departments",
  component: DepartmentsPage,
});

const shiftsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/shifts",
  component: ShiftsPage,
  validateSearch: (raw: Record<string, unknown>) => ({
    departmentId:
      typeof raw.departmentId === "string" && raw.departmentId.length > 0
        ? raw.departmentId
        : undefined,
  }),
});

const coverageRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/coverage",
  component: CoveragePage,
});

const leaveRequestsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/leave-requests",
  component: LeaveRequestsPage,
});

const absencesRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/absences",
  component: AbsencesPage,
});

const billingPlanRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/billing/plan",
  component: BillingPlanPage,
});

const billingPaymentsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/billing/payments",
  component: BillingPaymentsPage,
});

const billingUpgradeRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/billing/upgrade",
  component: BillingUpgradePage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute.addChildren([
    dashboardIndexRoute,
    profileRoute,
    institutionRoute,
    usersRoute,
    departmentsRoute,
    shiftsRoute,
    coverageRoute,
    leaveRequestsRoute,
    absencesRoute,
    billingPlanRoute,
    billingPaymentsRoute,
    billingUpgradeRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
