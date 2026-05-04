import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth.store";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

const REMEMBER_EMAIL_KEY = "mediscala-admin-remembered-email";

function getLoginErrorMessage(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: unknown }).response === "object" &&
    (err as { response?: unknown }).response !== null
  ) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    const message = response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Credenciais inválidas";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data } = await api.post("/auth/login", {
        email: normalizedEmail,
        password,
      });
      const accessToken = data?.data?.accessToken as string | undefined;
      const user = data?.data?.user as
        | { email?: string; name?: string }
        | undefined;

      if (!accessToken) {
        throw new Error("Resposta de autenticação inválida");
      }

      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      setAuth(
        accessToken,
        user?.email ?? normalizedEmail,
        user?.name ?? "Super Admin",
      );
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex lg:w-[52%] bg-[#0B1F3A] relative overflow-hidden flex-col">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-teal-500/5 -translate-y-1/3 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-teal-400/8 translate-y-1/3 -translate-x-1/3" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="MediScala"
              className="w-10 h-10 object-contain"
              onError={(e) => {
                e.currentTarget.src = "/logo-dark.png";
              }}
            />
            <span className="text-xl font-bold text-white tracking-tight">
              Medi<span className="text-teal-400">Scala</span>
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-sm">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-400/10 border border-teal-400/20 text-teal-300 text-xs font-medium tracking-wider uppercase mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                Sistema administrativo
              </div>
              <h1 className="text-4xl font-bold text-white leading-tight mb-4">
                Gestão institucional
                <br />
                <span className="text-teal-400">com controle total</span>
              </h1>
              <p className="text-slate-400 text-base leading-relaxed">
                Gerencie tenants, planos, subscrições e pagamentos com uma
                experiência consistente com a plataforma MediScala.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                "Gestão centralizada de tenants",
                "Monitorização de subscrições e pagamentos",
                "Acesso seguro com sessão protegida",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-teal-400/15 border border-teal-400/30 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  </div>
                  <span className="text-slate-300 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-slate-600 text-xs">
            © {new Date().getFullYear()} MediScala · Admin Console
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[radial-gradient(circle_at_top,_rgba(15,110,86,0.06),_transparent_40%)]">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <img
              src="/logo-dark.png"
              alt="MediScala"
              className="w-8 h-8 object-contain"
            />
            <span className="text-lg font-bold text-[#0B1F3A]">
              Medi<span className="text-teal-500">Scala</span>
            </span>
          </div>

          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-500 mb-2">
              Painel administrativo
            </p>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-slate-500 mt-1.5 text-sm">
              Introduza as suas credenciais para aceder ao sistema.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-7">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="admin-email"
                  className="text-sm font-medium text-slate-700"
                >
                  Endereço de email
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-400 transition-all h-11 text-sm text-slate-900 px-3 outline-none"
                    placeholder="admin@mediscala.co.ao"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="admin-password"
                  className="text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                    onBlur={() => setCapsLockOn(false)}
                    disabled={loading}
                    className="w-full pl-10 pr-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-400 transition-all h-11 text-sm text-slate-900 px-3 outline-none"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    aria-label={showPassword ? "Ocultar password" : "Mostrar password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {capsLockOn && (
                  <p className="text-xs text-amber-700 mt-1.5">
                    Caps Lock está ativo.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2.5">
                <label
                  htmlFor="admin-remember-me"
                  className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer"
                >
                  <input
                    id="admin-remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Lembrar email
                </label>

                <a
                  href="mailto:suporte@mediscala.co.ao?subject=Recuperacao%20de%20acesso%20admin"
                  className="text-xs font-medium text-teal-700 hover:text-teal-800"
                >
                  Esqueceu a password?
                </a>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-[#0B1F3A] hover:bg-[#0f2a4d] text-white font-semibold shadow-sm transition-all gap-2 mt-1 inline-flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    A entrar...
                  </>
                ) : (
                  <>
                    Entrar na plataforma
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <p className="text-[11px] text-slate-400 text-center mt-3 leading-relaxed">
                Acesso restrito a utilizadores autorizados. Ao entrar, aceita os
                Termos e a Política de Privacidade.
              </p>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6">
              © {new Date().getFullYear()} MediScala · Todos os direitos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
