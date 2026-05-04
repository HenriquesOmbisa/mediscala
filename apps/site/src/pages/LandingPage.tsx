import { useState, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  badge?: string;
};

// ── Data ───────────────────────────────────────────────────────────────────
const NAV_LINKS = ["Início", "Sobre", "Preços", "Contacto"];

const FEATURES = [
  {
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
      </svg>
    ),
    title: "Escalas por departamento",
    desc: "Organize turnos com controlo visual de cobertura. Identifique lacunas antes que virem urgências.",
  },
  {
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "Visibilidade em tempo real",
    desc: "Dashboard com métricas de cobertura, ausências e carga por profissional. Decisões baseadas em dados.",
  },
  {
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: "Alertas de ausência",
    desc: "Pedidos de folga centralizados com fluxo de aprovação e notificações automáticas de cobertura.",
  },
  {
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Auditoria e governança",
    desc: "Histórico completo de decisões e trilha de ações para conformidade administrativa.",
  },
  {
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4" /><path d="M5.5 20.5a9 9 0 0 1 13 0" />
      </svg>
    ),
    title: "Gestão de equipas",
    desc: "Equilíbrio de carga por profissional com regras configuráveis por setor e especialidade.",
  },
  {
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: "Multi-unidade",
    desc: "Visão consolidada para redes hospitalares com isolamento seguro por unidade.",
  },
];

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "89.000",
    period: " AOA/mês",
    description: "Para clínicas e equipas em arranque operacional.",
    features: ["Até 25 utilizadores", "Até 5 departamentos", "Cobertura e ausências com histórico", "Suporte em horário comercial"],
    cta: "Começar com Starter",
  },
  {
    name: "Growth",
    price: "189.000",
    period: " AOA/mês",
    description: "Para hospitais em expansão com múltiplas equipas.",
    features: ["Até 100 utilizadores", "Até 20 departamentos", "Regras avançadas de escala", "Relatórios operacionais por unidade"],
    cta: "Pedir demo Growth",
    highlight: true,
    badge: "Mais escolhido",
  },
  {
    name: "Professional",
    price: "349.000",
    period: " AOA/mês",
    description: "Para operações críticas com maior volume e governança.",
    features: ["Até 250 utilizadores", "Departamentos ilimitados", "Fluxos de aprovação e auditoria", "Onboarding assistido"],
    cta: "Falar com especialista",
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para redes hospitalares e grupos multi-unidade.",
    features: ["Multi-tenant avançado", "SLA e suporte prioritário", "Integrações personalizadas", "Acompanhamento executivo"],
    cta: "Solicitar proposta",
  },
];

const DASHBOARD_MOCKS = [
  "/imgs/client-dashboard-mock-1.png",
  "/imgs/client-dashboard-mock-2.png",
  "/imgs/client-dashboard-mock-3.png",
  "/imgs/client-dashboard-mock-4.png",
  "/imgs/client-dashboard-mock-5.png",
];

// ── Hooks ──────────────────────────────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function HeroShowcase() {
  return (
    <div className="hero-showcase">
      {/* Side cards */}
      <article className="hero-float-left">
        <img src={DASHBOARD_MOCKS[1]} alt="Gestão de turnos e equipas" loading="lazy" />
      </article>
      <article className="hero-float-right">
        <img src={DASHBOARD_MOCKS[3]} alt="Departamentos e distribuição de carga" loading="lazy" />
      </article>

      {/* Main browser frame */}
      <div className="hero-browser">
        <div className="hero-browser-bar">
          <span className="hero-browser-dot" style={{ background: "#FF6059" }} />
          <span className="hero-browser-dot" style={{ background: "#FEBC2E" }} />
          <span className="hero-browser-dot" style={{ background: "#28C840" }} />
          <div className="hero-browser-url" />
        </div>
        <img className="hero-browser-img" src={DASHBOARD_MOCKS[0]} alt="Painel principal do cliente MediScala" loading="eager" />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function MediScalaLanding() {
  const [activeNav, setActiveNav] = useState("Início");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const sectionMap: Array<[string, string]> = [
      ["hero", "Início"],
      ["sobre", "Sobre"],
      ["precos", "Preços"],
      ["contacto", "Contacto"],
    ];
    const observers: IntersectionObserver[] = [];
    for (const [id, label] of sectionMap) {
      const el = document.getElementById(id);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveNav(label); },
        { threshold: 0.35 }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => { for (const obs of observers) obs.disconnect(); };
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navIds: Record<string, string> = {
    "Início": "hero",
    "Sobre": "sobre",
    "Preços": "precos",
    "Contacto": "contacto",
  };

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif", background: "#f8faf9", color: "#0d1f18", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.4; transform:scale(0.75); }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .hero-in { animation: fadeUp 0.7s ease both; }
        .d1 { animation-delay: 0.1s; }
        .d2 { animation-delay: 0.22s; }
        .d3 { animation-delay: 0.34s; }
        .d4 { animation-delay: 0.46s; }
        .d5 { animation-delay: 0.58s; }
        .feat-card:hover { transform: translateY(-5px) !important; border-color: #1D9E75 !important; }
        .plan-card:hover { transform: translateY(-4px) !important; }
        .contact-info-card:hover { border-color: #1D9E75 !important; }
        .nav-pill-btn { transition: background 0.2s, color 0.2s; }
        .btn-teal:hover { background: #1D9E75 !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,110,86,0.28) !important; }
        /* ── Nav layout ── */
        .site-nav { padding: 0 48px; }
        .nav-pill { display: flex; align-items: center; gap: 4px; background: white; border: 1px solid rgba(15,110,86,0.12); border-radius: 50px; padding: 5px 6px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); }
        .nav-cta { display: flex; align-items: center; gap: 14px; }
        .nav-hamburger { display: none; flex-direction: column; justify-content: center; gap: 5px; background: none; border: 1px solid rgba(15,110,86,0.15); border-radius: 10px; padding: 9px 10px; cursor: pointer; }
        .nav-hamburger span { display: block; width: 20px; height: 2px; background: #0a1a14; border-radius: 2px; transition: transform 0.2s, opacity 0.2s; }
        .nav-hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
        .nav-hamburger.open span:nth-child(2) { opacity: 0; }
        .nav-hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }
        .nav-mobile-menu { display: none; position: fixed; top: 68px; left: 0; right: 0; background: rgba(248,250,249,0.97); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(15,110,86,0.1); padding: 12px 20px 20px; z-index: 99; flex-direction: column; gap: 4px; }
        .nav-mobile-menu.open { display: flex; }
        .nav-mobile-link { padding: 12px 16px; border-radius: 12px; font-size: 15px; font-weight: 500; color: #4a6358; background: none; border: none; cursor: pointer; text-align: left; font-family: 'Montserrat', sans-serif; transition: background 0.15s, color 0.15s; width: 100%; }
        .nav-mobile-link:hover { background: rgba(15,110,86,0.07); color: #0F6E56; }
        .nav-mobile-link.active { background: rgba(15,110,86,0.08); color: #0F6E56; font-weight: 600; }
        .nav-mobile-cta { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(15,110,86,0.1); }
        /* ── Responsive section/grid layout ── */
        .section-pad { padding: 100px 80px; }
        .footer-pad { padding: 72px 80px 40px; }
        .footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 48px; }
        .footer-col-title { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.38); margin-bottom: 18px; }
        .footer-link { display: block; font-size: 14px; color: rgba(255,255,255,0.52); margin-bottom: 11px; transition: color 0.2s; background: none; border: none; padding: 0; cursor: pointer; text-align: left; font-family: 'Montserrat', sans-serif; }
        .footer-link:hover { color: rgba(255,255,255,0.9); }
        .footer-bar { max-width: 1120px; margin: 48px auto 0; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; position: relative; z-index: 2; }
        .pricing-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
        .mocks-bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-bottom: 44px; }
        .footer-inner { max-width: 1120px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .btn-outline:hover { background: #E1F5EE !important; border-color: #0F6E56 !important; color: #0F6E56 !important; }
        .pulse-dot { animation: pulse 2s ease-in-out infinite; }
        .hero-shell {
          max-width: 900px;
          margin: 0 auto;
          padding: 140px 32px 0;
          text-align: center;
        }
        .hero-proof-grid {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 28px;
        }
        .hero-proof {
          border: 1px solid rgba(15,110,86,0.13);
          border-radius: 50px;
          padding: 8px 16px;
          background: rgba(255,255,255,0.88);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hero-proof strong {
          font-size: 15px;
          font-weight: 700;
          color: #0a1a14;
          line-height: 1;
        }
        .hero-proof span {
          font-size: 12px;
          color: #6b8a7c;
        }
        .hero-divider {
          display: inline-block;
          width: 1px;
          height: 12px;
          background: rgba(15,110,86,0.2);
        }
        /* ── Browser frame showcase ── */
        .hero-showcase {
          position: relative;
          margin: 52px auto 0;
          max-width: 1160px;
          padding: 0 28px;
        }
        .hero-browser {
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(15,110,86,0.16);
          box-shadow:
            0 2px 0 rgba(255,255,255,0.6) inset,
            0 40px 80px rgba(10,26,20,0.18),
            0 0 0 1px rgba(10,26,20,0.06);
          background: #fff;
        }
        .hero-browser-bar {
          height: 38px;
          background: #f1f4f2;
          border-bottom: 1px solid rgba(15,110,86,0.1);
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 7px;
          flex-shrink: 0;
        }
        .hero-browser-dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
        }
        .hero-browser-url {
          flex: 1;
          margin: 0 14px;
          height: 22px;
          background: rgba(255,255,255,0.7);
          border: 1px solid rgba(15,110,86,0.1);
          border-radius: 6px;
        }
        .hero-browser-img {
          display: block;
          width: 100%;
          height: auto;
        }
        /* floating side cards */
        .hero-float-left,
        .hero-float-right {
          position: absolute;
          bottom: -24px;
          width: 30%;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(15,110,86,0.16);
          background: #fff;
          box-shadow: 0 20px 48px rgba(10,26,20,0.2);
        }
        .hero-float-left {
          left: -10px;
          transform: rotate(-2.8deg) translateY(0);
          z-index: 2;
        }
        .hero-float-right {
          right: -10px;
          transform: rotate(2.8deg) translateY(0);
          z-index: 2;
        }
        .hero-float-left img,
        .hero-float-right img {
          display: block;
          width: 100%;
          height: auto;
        }
        /* fade-out bottom gradient */
        .hero-showcase::after {
          content: "";
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 120px;
          background: linear-gradient(to bottom, transparent, #f8faf9);
          pointer-events: none;
          z-index: 5;
        }

        .product-showcase-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 22px;
          align-items: stretch;
        }
        .mock-card {
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid rgba(15,110,86,0.14);
          background: #ffffff;
          box-shadow: 0 24px 44px rgba(10, 26, 20, 0.1);
        }
        .mock-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .mobile-reserved-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(180px, 220px));
          gap: 22px;
          justify-content: center;
        }
        .mobile-reserved-frame {
          height: 430px;
          border-radius: 34px;
          padding: 14px;
          background: linear-gradient(150deg, rgba(10,26,20,0.95) 0%, rgba(15,110,86,0.94) 100%);
          box-shadow: 0 18px 40px rgba(10,26,20,0.32);
          animation: float 5s ease-in-out infinite;
        }
        .mobile-reserved-frame:nth-child(2) {
          animation-delay: 0.45s;
        }

        @media (max-width: 1100px) {
          .hero-shell { padding-top: 110px; }
          .hero-float-left, .hero-float-right { width: 26%; }
          .product-showcase-grid { grid-template-columns: 1fr; }
          .section-pad { padding: 80px 48px; }
          .footer-pad { padding: 56px 48px 36px; }
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 36px; }
        }
        @media (max-width: 960px) {
          .nav-hamburger { display: flex; }
          .nav-pill { display: none; }
          .nav-cta { display: none; }
          .about-grid { grid-template-columns: 1fr; gap: 40px; }
          .feat-grid { grid-template-columns: 1fr 1fr; }
          .pricing-grid { grid-template-columns: 1fr 1fr; }
          .contact-grid { grid-template-columns: 1fr; gap: 48px; }
          .section-pad { padding: 72px 36px; }
          .footer-pad { padding: 48px 36px 28px; }
        }
        @media (max-width: 600px) {
          .site-nav { padding: 0 20px; }
          .hero-shell { padding: 88px 16px 0; }
          .hero-showcase { padding: 0 10px; margin-top: 28px; }
          .hero-float-left { display: none; }
          .hero-float-right { display: none; }
          .hero-proof-grid { gap: 6px; }
          .hero-proof { padding: 7px 12px; }
          .hero-proof strong { font-size: 13px; }
          .section-pad { padding: 56px 20px; }
          .footer-pad { padding: 48px 20px 28px; }
          .footer-grid { grid-template-columns: 1fr; gap: 32px; }
          .footer-bar { flex-direction: column; text-align: center; }
          .feat-grid { grid-template-columns: 1fr; }
          .pricing-grid { grid-template-columns: 1fr; }
          .mocks-bottom-row { grid-template-columns: 1fr; }
          .mobile-reserved-grid { grid-template-columns: 1fr; justify-items: center; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="site-nav" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 68,
        background: scrolled ? "rgba(248,250,249,0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(15,110,86,0.1)" : "1px solid transparent",
        transition: "all 0.3s",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="MediScala" style={{ width: 36, height: 36, objectFit: "contain", display: "block" }} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 18, color: "#0a1a14", fontWeight: 700 }}>MediScala</span>
        </div>

        {/* Pill nav */}
        <div className="nav-pill">
          {NAV_LINKS.map(link => (
            <button
              key={link}
              type="button"
              className="nav-pill-btn"
              onClick={() => { setActiveNav(link); scrollTo(navIds[link]); }}
              style={{
                padding: "8px 20px",
                borderRadius: 50,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: activeNav === link ? 600 : 400,
                background: activeNav === link ? "#0F6E56" : "transparent",
                color: activeNav === link ? "white" : "#4a6358",
                transition: "all 0.2s",
              }}
            >
              {link}
            </button>
          ))}
        </div>

        {/* Right CTA */}
        <div className="nav-cta">
          <a href="http://localhost:5173/login" style={{ fontSize: 14, fontWeight: 500, color: "#4a6358" }}>
            Entrar
          </a>
          <a
            href="mailto:comercial@mediscala.co.ao"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 14, fontWeight: 600, color: "#0a1a14",
              padding: "8px 0",
            }}
          >
            Solicitar demo
            <span style={{
              width: 28, height: 28,
              background: "#0F6E56",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 14,
            }}>↗</span>
          </a>
        </div>

        {/* Hamburger — mobile only */}
        <button
          type="button"
          className={`nav-hamburger${mobileOpen ? " open" : ""}`}
          onClick={() => setMobileOpen(o => !o)}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile nav overlay */}
      <div className={`nav-mobile-menu${mobileOpen ? " open" : ""}`}>
        {NAV_LINKS.map(link => (
          <button
            key={link}
            type="button"
            className={`nav-mobile-link${activeNav === link ? " active" : ""}`}
            onClick={() => { setActiveNav(link); scrollTo(navIds[link]); setMobileOpen(false); }}
          >
            {link}
          </button>
        ))}
        <div className="nav-mobile-cta">
          <a
            href="http://localhost:5173/login"
            style={{ display: "block", textAlign: "center", padding: "13px", borderRadius: 50, fontSize: 14, fontWeight: 500, color: "#0F6E56", border: "1.5px solid rgba(15,110,86,0.25)" }}
          >
            Entrar
          </a>
          <a
            href="mailto:comercial@mediscala.co.ao"
            style={{ display: "block", textAlign: "center", padding: "13px", borderRadius: 50, fontSize: 14, fontWeight: 600, color: "white", background: "#0F6E56" }}
          >
            Solicitar demo
          </a>
        </div>
      </div>

      {/* ── HERO ── */}
      <section id="hero" style={{ position: "relative", overflow: "hidden", background: "#f8faf9", backgroundImage: "radial-gradient(circle, rgba(15,110,86,0.07) 1px, transparent 1px)", backgroundSize: "26px 26px" }}>
        <div className="hero-shell">

          {/* Badge */}
          <div className="hero-in" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#E1F5EE", border: "1px solid rgba(15,110,86,0.2)", borderRadius: 50, padding: "6px 14px 6px 8px", marginBottom: 24 }}>
            <span className="pulse-dot" style={{ width: 8, height: 8, background: "#0F6E56", borderRadius: "50%", display: "block" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "#0F6E56" }}>Plataforma SaaS · Angola</span>
          </div>

          {/* Headline */}
          <h1 className="hero-in d1" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(2.8rem, 5.5vw, 4.8rem)", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.035em", color: "#0a1a14", marginBottom: 20, maxWidth: 860, margin: "0 auto 20px" }}>
            Gestão clínica com ritmo de
            <span style={{ color: "#0F6E56", fontStyle: "italic" }}> equipa real.</span>
          </h1>

          {/* Sub */}
          <p className="hero-in d2" style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "#4a6358", maxWidth: 580, margin: "0 auto 32px" }}>
            Escalas, cobertura e ausências num único fluxo visual. Menos stress operacional, mais previsibilidade para todo o hospital.
          </p>

          {/* CTAs */}
          <div className="hero-in d3" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 0 }}>
            <a
              href="mailto:comercial@mediscala.co.ao"
              className="btn-teal"
              style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 28px", borderRadius: 50, background: "#0F6E56", color: "white", fontSize: 15, fontWeight: 600, border: "none", transition: "all 0.2s", cursor: "pointer" }}
            >
              Solicitar demonstração
              <span style={{ fontSize: 16 }}>→</span>
            </a>
            <a
              href="http://localhost:5173/login"
              className="btn-outline"
              style={{ display: "inline-flex", alignItems: "center", padding: "14px 28px", borderRadius: 50, background: "white", color: "#0F6E56", fontSize: 15, fontWeight: 500, border: "1.5px solid rgba(15,110,86,0.3)", transition: "all 0.2s", cursor: "pointer" }}
            >
              Aceder ao portal
            </a>
          </div>

          {/* KPI row */}
          <div className="hero-proof-grid hero-in d4">
            {["94%|Taxa de cobertura", "48+|Turnos / dia", "3x|Menos conflitos", "24/7|Visibilidade"].map(item => {
              const [value, label] = item.split("|");
              return (
                <div key={item} className="hero-proof">
                  <strong>{value}</strong>
                  <span className="hero-divider" />
                  <span>{label}</span>
                </div>
              );
            })}
          </div>

          {/* Showcase */}
          <div className="hero-in d5">
            <HeroShowcase />
          </div>
        </div>
      </section>

      {/* ── PRODUCT MOCKS ── */}
      <section className="section-pad" style={{ background: "linear-gradient(180deg, #f8faf9 0%, #eef7f2 100%)", borderTop: "1px solid rgba(15,110,86,0.08)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <Reveal>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0F6E56", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "block", width: 20, height: 2, background: "#0F6E56", borderRadius: 2 }} />
              Produto em ação
            </p>
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(2rem, 3vw, 2.8rem)", fontWeight: 700, color: "#0a1a14", lineHeight: 1.15, marginBottom: 14, letterSpacing: "-0.02em" }}>
              O painel do gestor,
              <span style={{ fontStyle: "italic", color: "#0F6E56" }}> sem ruído</span>
            </h2>
            <p style={{ fontSize: "1rem", color: "#4a6358", lineHeight: 1.7, maxWidth: 620, marginBottom: 40 }}>
              Uma captura real da plataforma em contexto operacional — escalas, coberturas e alertas visíveis numa leitura só.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <article className="mock-card" style={{ borderRadius: 20, overflow: "hidden" }}>
              <img
                src={DASHBOARD_MOCKS[4]}
                alt="Painel de gestão de escalas e cobertura da MediScala"
                loading="lazy"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </article>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="section-pad" style={{ background: "white" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <Reveal>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0F6E56", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "block", width: 20, height: 2, background: "#0F6E56", borderRadius: 2 }} />
              Funcionalidades
            </p>
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(2rem, 3vw, 2.8rem)", fontWeight: 700, color: "#0a1a14", lineHeight: 1.15, marginBottom: 14, letterSpacing: "-0.02em" }}>
              Tudo para gerir escalas{" "}
              <span style={{ fontStyle: "italic", color: "#0F6E56" }}>sem fricção</span>
            </h2>
            <p style={{ fontSize: "1rem", color: "#4a6358", lineHeight: 1.7, maxWidth: 520, marginBottom: 60 }}>
              Projetado para o ritmo real dos hospitais — cada função resolve um problema concreto da coordenação clínica.
            </p>
          </Reveal>

          <div className="feat-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div
                  className="feat-card"
                  style={{
                    border: "1px solid rgba(15,110,86,0.1)",
                    borderRadius: 18,
                    padding: "30px 28px",
                    background: "#f8faf9",
                    transition: "transform 0.2s, border-color 0.2s",
                    cursor: "default",
                  }}
                >
                  <div style={{ width: 44, height: 44, background: "#E1F5EE", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, color: "#0F6E56" }}>
                    {f.icon}
                  </div>
                  <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 18, fontWeight: 700, color: "#0a1a14", marginBottom: 10 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#4a6358" }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="sobre" className="section-pad" style={{ background: "#0a1a14", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(29,158,117,0.1) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div className="about-grid" style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div>
            <Reveal>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5DCAA5", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "block", width: 20, height: 2, background: "#5DCAA5", borderRadius: 2 }} />
                Sobre a MediScala
              </p>
              <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(2rem, 3vw, 2.8rem)", fontWeight: 700, color: "white", lineHeight: 1.15, marginBottom: 24, letterSpacing: "-0.02em" }}>
                Tecnologia feita para{" "}
                <span style={{ fontStyle: "italic", color: "#5DCAA5" }}>a rotina clínica</span>
              </h2>
              <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>
                A MediScala nasceu para resolver um problema clássico da gestão hospitalar: equipas sobrecarregadas por escalas fragmentadas, comunicação dispersa e decisões de cobertura sem histórico.
              </p>
              <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(255,255,255,0.55)" }}>
                O foco é dar previsibilidade operacional para direção, coordenação e colaboradores — sem aumentar a complexidade para quem já trabalha sob pressão constante.
              </p>
            </Reveal>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              ["01", "Menos urgências de última hora", "Identifique lacunas com antecedência e distribua cobertura com regras consistentes."],
              ["02", "Mais previsibilidade da equipa", "Padronize escalas e mantenha equilíbrio de carga por profissional e setor."],
              ["03", "Governança para crescimento", "Estruture operação multi-unidade com trilha de ações e visão consolidada."],
            ].map(([num, title, desc], i) => (
              <Reveal key={num} delay={i * 100}>
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, padding: "22px 26px",
                  display: "flex", gap: 18, alignItems: "flex-start",
                  transition: "border-color 0.2s",
                }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 28, color: "#5DCAA5", opacity: 0.6, lineHeight: 1, flexShrink: 0 }}>{num}</span>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 5 }}>{title}</h4>
                    <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.42)", lineHeight: 1.6 }}>{desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="precos" className="section-pad" style={{ background: "#f8faf9" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 64px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0F6E56", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ display: "block", width: 20, height: 2, background: "#0F6E56", borderRadius: 2 }} />
                Preços
                <span style={{ display: "block", width: 20, height: 2, background: "#0F6E56", borderRadius: 2 }} />
              </p>
              <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(2rem, 3vw, 2.8rem)", fontWeight: 700, color: "#0a1a14", lineHeight: 1.15, marginBottom: 14, letterSpacing: "-0.02em" }}>
                Planos para{" "}
                <span style={{ fontStyle: "italic", color: "#0F6E56" }}>cada fase</span>{" "}
                da operação
              </h2>
              <p style={{ fontSize: "1rem", color: "#4a6358", lineHeight: 1.7 }}>
                Todos incluem gestão de escalas, cobertura e visibilidade administrativa em tempo real.
              </p>
            </div>
          </Reveal>

          <div className="pricing-grid">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 80}>
                <div
                  className="plan-card"
                  style={{
                    background: plan.highlight ? "#0a1a14" : "white",
                    border: plan.highlight ? "2px solid #0F6E56" : "1px solid rgba(15,110,86,0.12)",
                    borderRadius: 20,
                    padding: "30px 24px",
                    display: "flex", flexDirection: "column",
                    position: "relative",
                    transition: "transform 0.2s",
                    height: "100%",
                  }}
                >
                  {plan.badge && (
                    <span style={{
                      position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                      background: "#0F6E56", color: "white",
                      fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                      padding: "4px 16px", borderRadius: 50, whiteSpace: "nowrap",
                    }}>{plan.badge}</span>
                  )}

                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: plan.highlight ? "rgba(255,255,255,0.4)" : "#6b8a7c", marginBottom: 12 }}>{plan.name}</p>

                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: plan.price === "Sob consulta" ? 22 : 28, fontWeight: 700, color: plan.highlight ? "white" : "#0a1a14", lineHeight: 1.1, marginBottom: 4 }}>
                    {plan.price}
                    {plan.period && <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 400, color: plan.highlight ? "rgba(255,255,255,0.35)" : "#6b8a7c" }}>{plan.period}</span>}
                  </p>

                  <p style={{ fontSize: 13.5, color: plan.highlight ? "rgba(255,255,255,0.5)" : "#4a6358", lineHeight: 1.6, marginBottom: 24, minHeight: 44 }}>{plan.description}</p>

                  <div style={{ height: 1, background: plan.highlight ? "rgba(255,255,255,0.08)" : "rgba(15,110,86,0.08)", marginBottom: 20 }} />

                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, flex: 1, marginBottom: 26 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ fontSize: 13.5, color: plan.highlight ? "rgba(255,255,255,0.6)" : "#4a6358", display: "flex", alignItems: "flex-start", gap: 9, lineHeight: 1.5 }}>
                        <span style={{
                          width: 18, height: 18, flexShrink: 0, marginTop: 1, borderRadius: "50%",
                          background: plan.highlight ? "rgba(93,202,165,0.2)" : "#E1F5EE",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <polyline points="2,5 4,7.5 8,3" stroke={plan.highlight ? "#5DCAA5" : "#0F6E56"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="mailto:comercial@mediscala.co.ao"
                    style={{
                      display: "block", textAlign: "center",
                      padding: "12px", borderRadius: 50,
                      fontSize: 14, fontWeight: 600,
                      background: plan.highlight ? "#0F6E56" : "transparent",
                      color: plan.highlight ? "white" : "#0F6E56",
                      border: plan.highlight ? "none" : "1.5px solid rgba(15,110,86,0.25)",
                      transition: "all 0.2s", cursor: "pointer",
                    }}
                  >
                    {plan.cta}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <p style={{ textAlign: "center", fontSize: 13, color: "#6b8a7c", marginTop: 28 }}>
              Valores em AOA · Sujeitos a ajuste conforme escopo e volume operacional
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contacto" className="section-pad" style={{ background: "white" }}>
        <div className="contact-grid" style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div>
            <Reveal>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0F6E56", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "block", width: 20, height: 2, background: "#0F6E56", borderRadius: 2 }} />
                Contacto
              </p>
              <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(1.8rem, 2.8vw, 2.6rem)", fontWeight: 700, color: "#0a1a14", lineHeight: 1.18, marginBottom: 16, letterSpacing: "-0.02em" }}>
                Vamos falar sobre a operação do seu{" "}
                <span style={{ fontStyle: "italic", color: "#0F6E56" }}>hospital</span>
              </h2>
              <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "#4a6358", marginBottom: 36 }}>
                Para agendar uma demonstração ou discutir implementação, entre em contacto com a nossa equipa.
              </p>
            </Reveal>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                {
                  icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
                  label: "Email",
                  value: <a href="mailto:comercial@mediscala.co.ao" style={{ color: "#0F6E56" }}>comercial@mediscala.co.ao</a>,
                },
                {
                  icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.91-1.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
                  label: "Telefone",
                  value: "+244 900 000 000",
                },
                {
                  icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
                  label: "Horário",
                  value: "Segunda a sexta, 08:00 – 18:00 (WAT)",
                },
              ].map((c, i) => (
                <Reveal key={c.label} delay={i * 80}>
                  <div
                    className="contact-info-card"
                    style={{
                      display: "flex", alignItems: "center", gap: 16,
                      background: "#f8faf9", border: "1px solid rgba(15,110,86,0.1)",
                      borderRadius: 14, padding: "18px 20px",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <div style={{ width: 40, height: 40, background: "#E1F5EE", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div style={{ width: 18, height: 18 }}>{c.icon}</div>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b8a7c", marginBottom: 3 }}>{c.label}</p>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#0a1a14" }}>{c.value}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Form */}
          <Reveal delay={100}>
            <div style={{ background: "#f8faf9", border: "1px solid rgba(15,110,86,0.1)", borderRadius: 20, padding: "40px 36px" }}>
              <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 22, fontWeight: 700, color: "#0a1a14", marginBottom: 28 }}>Agendar demonstração</h3>

              {[
                { label: "Nome completo", id: "nome", type: "text", placeholder: "Dr. João Silva" },
                { label: "Hospital / Instituição", id: "hospital", type: "text", placeholder: "Hospital Central de Luanda" },
                { label: "Email profissional", id: "email", type: "email", placeholder: "joao@hospital.co.ao" },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 18 }}>
                  <label htmlFor={f.id} style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4a6358", marginBottom: 6 }}>{f.label}</label>
                  <input
                    id={f.id}
                    type={f.type}
                    placeholder={f.placeholder}
                    style={{
                      width: "100%", padding: "12px 16px",
                      fontFamily: "'Montserrat', sans-serif", fontSize: 14,
                      border: "1px solid rgba(15,110,86,0.15)", borderRadius: 10,
                      background: "white", color: "#0a1a14", outline: "none",
                    }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 24 }}>
                <label htmlFor="mensagem" style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#4a6358", marginBottom: 6 }}>Mensagem (opcional)</label>
                <textarea
                  id="mensagem"
                  placeholder="Descreva brevemente o principal desafio da operação..."
                  rows={3}
                  style={{
                    width: "100%", padding: "12px 16px",
                    fontFamily: "'Montserrat', sans-serif", fontSize: 14,
                    border: "1px solid rgba(15,110,86,0.15)", borderRadius: 10,
                    background: "white", color: "#0a1a14", outline: "none", resize: "vertical",
                  }}
                />
              </div>

              <button
                type="button"
                className="btn-teal"
                style={{
                  width: "100%", padding: "14px",
                  fontFamily: "'Montserrat', sans-serif", fontSize: 15, fontWeight: 600,
                  color: "white", background: "#0F6E56", border: "none",
                  borderRadius: 50, cursor: "pointer", transition: "all 0.2s",
                }}
                onClick={e => {
                  const btn = e.currentTarget;
                  btn.textContent = "Enviado ✓";
                  btn.style.background = "#085041";
                  btn.disabled = true;
                }}
              >
                Enviar pedido de demonstração
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer-pad" style={{ background: "#0a1a14" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div className="footer-grid">
            {/* Brand col */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <img src="/logo.png" alt="MediScala" style={{ width: 32, height: 32, objectFit: "contain" }} />
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 17, fontWeight: 700, color: "white" }}>MediScala</span>
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.42)", lineHeight: 1.75, maxWidth: 260, marginBottom: 24 }}>
                Plataforma SaaS de gestão de escalas e cobertura para unidades de saúde em Angola.
              </p>
              <a
                href="mailto:comercial@mediscala.co.ao"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 50, background: "rgba(15,110,86,0.2)", border: "1px solid rgba(15,110,86,0.35)", color: "#5DCAA5", fontSize: 13, fontWeight: 600, transition: "background 0.2s" }}
              >
                Solicitar demo ↗
              </a>
            </div>

            {/* Produto */}
            <div>
              <p className="footer-col-title">Produto</p>
              <button type="button" className="footer-link" onClick={() => document.getElementById("hero")?.scrollIntoView({ behavior: "smooth" })}>Visão geral</button>
              <button type="button" className="footer-link" onClick={() => document.getElementById("sobre")?.scrollIntoView({ behavior: "smooth" })}>Funcionalidades</button>
              <button type="button" className="footer-link" onClick={() => document.getElementById("precos")?.scrollIntoView({ behavior: "smooth" })}>Preços</button>
              <a className="footer-link" href="http://localhost:5173/login">Portal do cliente</a>
            </div>

            {/* Empresa */}
            <div>
              <p className="footer-col-title">Empresa</p>
              <button type="button" className="footer-link" onClick={() => document.getElementById("sobre")?.scrollIntoView({ behavior: "smooth" })}>Sobre</button>
              <a className="footer-link" href="/termos">Termos de Uso</a>
              <a className="footer-link" href="/privacidade">Privacidade</a>
              <a className="footer-link" href="/cookies">Cookies</a>
            </div>

            {/* Contacto */}
            <div>
              <p className="footer-col-title">Contacto</p>
              <a className="footer-link" href="mailto:comercial@mediscala.co.ao">comercial@mediscala.co.ao</a>
              <a className="footer-link" href="tel:+244900000000">+244 900 000 000</a>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 16, lineHeight: 1.6 }}>
                Segunda a sexta<br />08:00 – 18:00 (WAT)
              </p>
            </div>
          </div>

          <div className="footer-bar">
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.22)" }}>© 2026 MediScala · Todos os direitos reservados · Angola</span>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
              <a href="/termos" style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", transition: "color 0.2s" }}>Termos</a>
              <a href="/privacidade" style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", transition: "color 0.2s" }}>Privacidade</a>
              <a href="/cookies" style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", transition: "color 0.2s" }}>Cookies</a>
              <a href="mailto:comercial@mediscala.co.ao" style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", transition: "color 0.2s" }}>Contacto</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}