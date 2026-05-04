import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { MediScalaLanding } from "./pages/LandingPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { CookiesPage } from "./pages/CookiesPage";

// ── Minimal layout for legal/document pages ─────────────────────────────────
function LegalLayout() {
  return (
    <div className="site-shell legal-shell">
      <header className="topbar">
        <div className="container nav-wrap">
          <Link to="/" className="brand-link" reloadDocument>
            <img src="/logo.png" alt="MediScala" className="brand-logo" />
            <span>MediScala</span>
          </Link>
          <nav className="main-nav" aria-label="Menu principal">
            <Link to="/" reloadDocument>
              Início
            </Link>
            <Link to="/privacidade" activeProps={{ className: "active" }}>
              Privacidade
            </Link>
            <Link to="/termos" activeProps={{ className: "active" }}>
              Termos
            </Link>
            <Link to="/cookies" activeProps={{ className: "active" }}>
              Cookies
            </Link>
          </nav>
          <div className="nav-actions">
            <a className="btn ghost" href="http://localhost:5173/login">
              Entrar
            </a>
            <a className="btn solid" href="/#contacto">
              Pedir demo
            </a>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-wrap">
          <div>
            <p className="footer-brand">MediScala</p>
            <p>Gestão hospitalar orientada por escala real.</p>
          </div>
          <div className="footer-links">
            <Link to="/privacidade">Privacidade</Link>
            <Link to="/termos">Termos</Link>
            <Link to="/cookies">Cookies</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Landing has its own nav/footer — no layout wrapper
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: MediScalaLanding,
});

// Legal pages use the minimal layout
const legalLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "legal-layout",
  component: LegalLayout,
});

const privacyRoute = createRoute({
  getParentRoute: () => legalLayoutRoute,
  path: "/privacidade",
  component: PrivacyPage,
});

const termsRoute = createRoute({
  getParentRoute: () => legalLayoutRoute,
  path: "/termos",
  component: TermsPage,
});

const cookiesRoute = createRoute({
  getParentRoute: () => legalLayoutRoute,
  path: "/cookies",
  component: CookiesPage,
});

const routeTree = rootRoute.addChildren([
  landingRoute,
  legalLayoutRoute.addChildren([privacyRoute, termsRoute, cookiesRoute]),
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
