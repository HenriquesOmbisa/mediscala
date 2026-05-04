export function PrivacyPage() {
  return (
    <section className="section">
      <div className="container prose reveal" style={{ maxWidth: 780, padding: "64px 24px 96px" }}>

        <p className="eyebrow">Política de Privacidade</p>
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", lineHeight: 1.1, margin: "12px 0 8px" }}>
          Tratamento responsável de dados pessoais
        </h1>
        <p style={{ color: "#6b7a8d", fontSize: 14, marginBottom: 40 }}>
          Última actualização: 2 de maio de 2026 · Versão 1.0
        </p>

        <Legal.Section title="1. Quem somos">
          <p>
            A <strong>MediScala, Lda.</strong>, com sede em Luanda, República de Angola
            ("<strong>MediScala</strong>", "<strong>nós</strong>"), é a responsável pelo tratamento
            dos dados pessoais recolhidos através da plataforma MediScala e do sítio{" "}
            <a href="https://mediscala.co.ao" style={{ color: "#0F6E56" }}>mediscala.co.ao</a>.
          </p>
          <p>
            Tratamos os dados com respeito, transparência e em conformidade com a legislação angolana
            aplicável à protecção de dados pessoais e às obrigações específicas do sector da saúde.
          </p>
        </Legal.Section>

        <Legal.Section title="2. Dados que recolhemos">
          <p>Recolhemos diferentes categorias de dados consoante o contexto:</p>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0a1a14", marginBottom: 6 }}>2.1 Dados de conta e contacto</h3>
          <ul>
            <li>Nome completo e cargo do administrador e utilizadores;</li>
            <li>Endereço de email profissional e número de telefone;</li>
            <li>Nome e NIF da organização de saúde;</li>
            <li>Dados de facturação quando aplicável.</li>
          </ul>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0a1a14", marginBottom: 6 }}>2.2 Dados operacionais</h3>
          <ul>
            <li>Escalas, turnos e departamentos configurados pelo Cliente;</li>
            <li>Registos de presença, ausência e substituição de profissionais de saúde;</li>
            <li>Notificações e comunicações internas geradas na Plataforma.</li>
          </ul>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0a1a14", marginBottom: 6 }}>2.3 Dados técnicos</h3>
          <ul>
            <li>Endereço IP, tipo de browser e sistema operativo;</li>
            <li>Registos de acesso e actividade na Plataforma (logs);</li>
            <li>Cookies e identificadores de sessão (ver Política de Cookies).</li>
          </ul>
        </Legal.Section>

        <Legal.Section title="3. Finalidades e bases legais">
          <p>Os dados são tratados para as seguintes finalidades:</p>
          <ul>
            <li><strong>Prestação do serviço contratado</strong> — execução do contrato de subscrição;</li>
            <li><strong>Gestão de conta e autenticação</strong> — interesse legítimo e execução contratual;</li>
            <li><strong>Facturação e suporte</strong> — obrigação legal e execução contratual;</li>
            <li><strong>Melhoria da Plataforma</strong> — interesse legítimo da MediScala, com dados anonimizados;</li>
            <li><strong>Cumprimento de obrigações legais</strong> — legislação angolana aplicável;</li>
            <li><strong>Comunicações comerciais</strong> — consentimento, revogável a qualquer momento.</li>
          </ul>
        </Legal.Section>

        <Legal.Section title="4. Partilha de dados">
          <p>
            A MediScala não vende, arrenda nem cede dados pessoais a terceiros para fins comerciais.
            Os dados podem ser partilhados apenas com:
          </p>
          <ul>
            <li><strong>Subcontratantes técnicos</strong> — fornecedores de infraestrutura cloud, serviços de email transaccional e monitorização de segurança, vinculados por acordo de processamento de dados;</li>
            <li><strong>Autoridades competentes</strong> — quando exigido por lei ou decisão judicial;</li>
            <li><strong>Sucessores legais</strong> — em caso de fusão, aquisição ou transferência de activos, com notificação prévia ao Cliente.</li>
          </ul>
        </Legal.Section>

        <Legal.Section title="5. Retenção de dados">
          <p>
            Os dados de conta são conservados durante o período de subscrição activo e por um máximo de
            5 anos após cessação, para efeitos de obrigações legais e fiscais.
          </p>
          <p>
            Os dados operacionais introduzidos pelo Cliente são eliminados em até 30 dias após solicitação
            expressa de apagamento ou no prazo de 60 dias após o términus contratual, salvo obrigação
            legal de conservação superior.
          </p>
        </Legal.Section>

        <Legal.Section title="6. Segurança">
          <p>
            Aplicamos medidas técnicas e organizativas adequadas para proteger os dados contra acesso
            não autorizado, perda, destruição ou divulgação, incluindo:
          </p>
          <ul>
            <li>Cifra em trânsito (TLS 1.3) e em repouso;</li>
            <li>Controlo de acesso por função (RBAC) com autenticação de dois factores disponível;</li>
            <li>Monitorização contínua e registos de auditoria;</li>
            <li>Testes periódicos de segurança e revisão de código.</li>
          </ul>
          <p>
            Em caso de incidente de segurança com impacto nos dados pessoais, notificaremos os Clientes
            afectados no prazo de 72 horas a contar da detecção.
          </p>
        </Legal.Section>

        <Legal.Section title="7. Direitos dos titulares">
          <p>Os utilizadores têm o direito de, a qualquer momento:</p>
          <ul>
            <li><strong>Aceder</strong> aos seus dados pessoais tratados pela MediScala;</li>
            <li><strong>Rectificar</strong> dados inexactos ou incompletos;</li>
            <li><strong>Apagar</strong> dados, nos limites permitidos por lei;</li>
            <li><strong>Opor-se</strong> ao tratamento baseado em interesse legítimo;</li>
            <li><strong>Portabilidade</strong> — receber os dados em formato estruturado e legível;</li>
            <li><strong>Retirar o consentimento</strong> para comunicações comerciais.</li>
          </ul>
          <p>
            Para exercer estes direitos, contacte:{" "}
            <a href="mailto:privacidade@mediscala.co.ao" style={{ color: "#0F6E56", fontWeight: 600 }}>
              privacidade@mediscala.co.ao
            </a>
          </p>
        </Legal.Section>

        <Legal.Section title="8. Transferências internacionais">
          <p>
            Os dados são preferencialmente armazenados em servidores localizados em África. Quando ocorram
            transferências para jurisdições externas, garantimos que existem salvaguardas adequadas,
            como cláusulas contratuais-tipo ou certificações equivalentes.
          </p>
        </Legal.Section>

        <Legal.Section title="9. Alterações a esta Política">
          <p>
            Esta Política pode ser actualizada. A data de revisão no topo indica a versão em vigor.
            Alterações materiais serão comunicadas por email com 15 dias de antecedência.
          </p>
        </Legal.Section>

        <Legal.Section title="10. Contacto e reclamações">
          <p>
            Para qualquer questão sobre esta Política ou o tratamento dos seus dados:{" "}
            <a href="mailto:privacidade@mediscala.co.ao" style={{ color: "#0F6E56", fontWeight: 600 }}>
              privacidade@mediscala.co.ao
            </a>
          </p>
          <p>
            Tem também o direito de apresentar reclamação junto da autoridade de protecção de dados
            competente em Angola.
          </p>
        </Legal.Section>

      </div>
    </section>
  );
}

// ── Shared layout helper ──────────────────────────────────────────────────────
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
