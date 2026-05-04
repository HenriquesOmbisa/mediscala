export function CookiesPage() {
  return (
    <section className="section">
      <div className="container prose reveal" style={{ maxWidth: 780, padding: "64px 24px 96px" }}>

        <p className="eyebrow">Política de Cookies</p>
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", lineHeight: 1.1, margin: "12px 0 8px" }}>
          Como e porquê utilizamos cookies
        </h1>
        <p style={{ color: "#6b7a8d", fontSize: 14, marginBottom: 40 }}>
          Última actualização: 2 de maio de 2026 · Versão 1.0
        </p>

        <Legal.Section title="1. O que são cookies">
          <p>
            Cookies são pequenos ficheiros de texto colocados no seu dispositivo quando visita um sítio
            web ou utiliza uma aplicação. Permitem que o sítio reconheça o seu browser, memorize
            preferências e recolha informações sobre a navegação.
          </p>
          <p>
            A MediScala utiliza cookies e tecnologias similares (como armazenamento local e identificadores
            de sessão) na Plataforma e no sítio <a href="https://mediscala.co.ao" style={{ color: "#0F6E56" }}>mediscala.co.ao</a>.
          </p>
        </Legal.Section>

        <Legal.Section title="2. Tipos de cookies que utilizamos">

          <CookieTable rows={[
            {
              name: "ms_session",
              type: "Essencial",
              duration: "Sessão",
              purpose: "Mantém a sessão autenticada do utilizador durante o uso da Plataforma. Sem este cookie, o login não funciona.",
            },
            {
              name: "ms_csrf",
              type: "Essencial",
              duration: "Sessão",
              purpose: "Token de protecção contra ataques CSRF (Cross-Site Request Forgery). Obrigatório para segurança das acções do utilizador.",
            },
            {
              name: "ms_prefs",
              type: "Funcional",
              duration: "1 ano",
              purpose: "Guarda preferências da interface como idioma, tema e configurações de vista de escalas.",
            },
            {
              name: "ms_remember",
              type: "Funcional",
              duration: "30 dias",
              purpose: "Activo quando o utilizador escolhe \"manter sessão iniciada\". Permite o reingresso sem nova autenticação.",
            },
            {
              name: "_analytics",
              type: "Análise",
              duration: "13 meses",
              purpose: "Estatísticas de uso agregadas e anonimizadas: páginas visitadas, duração de sessão e funcionalidades mais utilizadas. Não identifica o utilizador individualmente.",
            },
          ]} />

          <p style={{ marginTop: 12 }}>
            <strong>Nota:</strong> A MediScala não utiliza cookies de publicidade ou de rastreamento
            por terceiros para fins comerciais.
          </p>
        </Legal.Section>

        <Legal.Section title="3. Cookies essenciais">
          <p>
            Os cookies marcados como <strong>Essenciais</strong> são estritamente necessários para o
            funcionamento da Plataforma e não podem ser desactivados sem comprometer a segurança
            e a autenticação. Não requerem consentimento nos termos da legislação aplicável.
          </p>
        </Legal.Section>

        <Legal.Section title="4. Cookies funcionais">
          <p>
            Os cookies <strong>Funcionais</strong> melhoram a experiência de uso ao memorizar escolhas
            do utilizador. Podem ser desactivados, mas isso pode afectar o comportamento da interface.
          </p>
        </Legal.Section>

        <Legal.Section title="5. Cookies de análise">
          <p>
            Utilizamos cookies de análise para compreender como a Plataforma é utilizada e identificar
            áreas de melhoria. Todos os dados recolhidos são <strong>anonimizados</strong> antes de
            qualquer processamento — não é possível identificar um utilizador específico a partir deles.
          </p>
          <p>
            Pode optar por não participar nas estatísticas de análise através das definições de cookies
            disponíveis no rodapé da Plataforma.
          </p>
        </Legal.Section>

        <Legal.Section title="6. Armazenamento local (localStorage / sessionStorage)">
          <p>
            Para além de cookies, a Plataforma pode utilizar o armazenamento local do browser para:
          </p>
          <ul>
            <li>Guardar temporariamente filtros e configurações de vista de escalas;</li>
            <li>Manter o estado da interface entre páginas sem comunicação com o servidor;</li>
            <li>Armazenar tokens de autenticação de curta duração.</li>
          </ul>
          <p>
            Estes dados residem exclusivamente no seu dispositivo e são eliminados ao limpar os dados
            de navegação ou ao terminar a sessão.
          </p>
        </Legal.Section>

        <Legal.Section title="7. Como gerir cookies">
          <p>
            Pode controlar e eliminar cookies através das definições do seu browser. Consulte as
            instruções do seu browser:
          </p>
          <ul>
            <li>
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" style={{ color: "#0F6E56" }}>
                Google Chrome
              </a>
            </li>
            <li>
              <a href="https://support.mozilla.org/pt-PT/kb/cookies-informacoes-armazenadas-websites" target="_blank" rel="noopener noreferrer" style={{ color: "#0F6E56" }}>
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a href="https://support.apple.com/pt-pt/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" style={{ color: "#0F6E56" }}>
                Safari
              </a>
            </li>
            <li>
              <a href="https://support.microsoft.com/pt-pt/microsoft-edge/eliminar-cookies-no-microsoft-edge" target="_blank" rel="noopener noreferrer" style={{ color: "#0F6E56" }}>
                Microsoft Edge
              </a>
            </li>
          </ul>
          <p>
            Tenha em atenção que a desactivação de cookies essenciais impedirá o funcionamento
            correcto da Plataforma.
          </p>
        </Legal.Section>

        <Legal.Section title="8. Actualizações a esta Política">
          <p>
            Esta Política pode ser actualizada para reflectir alterações técnicas ou legais. A data no
            topo indica a versão vigente. Alterações significativas serão comunicadas aos utilizadores
            registados por email.
          </p>
        </Legal.Section>

        <Legal.Section title="9. Contacto">
          <p>
            Para questões relacionadas com cookies ou esta Política:{" "}
            <a href="mailto:privacidade@mediscala.co.ao" style={{ color: "#0F6E56", fontWeight: 600 }}>
              privacidade@mediscala.co.ao
            </a>
          </p>
        </Legal.Section>

      </div>
    </section>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
const Legal = {
  Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0a1a14", marginBottom: 12, borderLeft: "3px solid #0F6E56", paddingLeft: 14 }}>
          {title}
        </h2>
        <div style={{ fontSize: "0.97rem", lineHeight: 1.8, color: "#3a4a40", display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      </div>
    );
  },
};

type CookieRow = { name: string; type: string; duration: string; purpose: string };

function CookieTable({ rows }: { rows: CookieRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
        <thead>
          <tr style={{ background: "#f0f7f4" }}>
            {["Nome", "Tipo", "Duração", "Finalidade"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, color: "#0a1a14", borderBottom: "2px solid #c8e6da" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} style={{ background: i % 2 === 0 ? "white" : "#f8faf9" }}>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #e4ede8", fontFamily: "monospace", color: "#0F6E56", fontWeight: 600 }}>{r.name}</td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #e4ede8", whiteSpace: "nowrap" }}>
                <span style={{
                  display: "inline-block", padding: "2px 10px", borderRadius: 50, fontSize: 11, fontWeight: 700,
                  background: r.type === "Essencial" ? "#E1F5EE" : r.type === "Funcional" ? "#EEF0FF" : "#FFF8E1",
                  color: r.type === "Essencial" ? "#0F6E56" : r.type === "Funcional" ? "#4B5BCD" : "#9A6700",
                }}>
                  {r.type}
                </span>
              </td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #e4ede8", whiteSpace: "nowrap" }}>{r.duration}</td>
              <td style={{ padding: "10px 14px", borderBottom: "1px solid #e4ede8", color: "#4a5568" }}>{r.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
