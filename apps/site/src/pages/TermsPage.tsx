export function TermsPage() {
  return (
    <section className="section">
      <div className="container prose reveal" style={{ maxWidth: 780, padding: "64px 24px 96px" }}>

        <p className="eyebrow">Termos de Uso</p>
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", lineHeight: 1.1, margin: "12px 0 8px" }}>
          Condições gerais de utilização
        </h1>
        <p style={{ color: "#6b7a8d", fontSize: 14, marginBottom: 40 }}>
          Última actualização: 2 de maio de 2026 · Versão 1.0
        </p>

        <Legal.Section title="1. Âmbito e aceitação">
          <p>
            Os presentes Termos de Uso ("<strong>Termos</strong>") regulam o acesso e a utilização da plataforma
            MediScala ("<strong>Plataforma</strong>"), disponibilizada pela <strong>MediScala, Lda.</strong>,
            com sede em Luanda, República de Angola ("<strong>MediScala</strong>", "<strong>nós</strong>").
          </p>
          <p>
            Ao aceder, registar ou utilizar a Plataforma, o utilizador ("<strong>Utilizador</strong>") e a
            organização de saúde que representa ("<strong>Cliente</strong>") declaram ter lido, compreendido e
            aceite a totalidade destes Termos. Caso não concorde, deverá cessar imediatamente a utilização.
          </p>
        </Legal.Section>

        <Legal.Section title="2. Descrição do serviço">
          <p>
            A MediScala é uma plataforma de Software como Serviço (SaaS) destinada à gestão operacional de
            unidades de saúde, incluindo:
          </p>
          <ul>
            <li>Planeamento e gestão de escalas por departamento e turno;</li>
            <li>Controlo de cobertura, ausências e substituições;</li>
            <li>Notificações e alertas operacionais em tempo real;</li>
            <li>Dashboards de monitorização da carga de trabalho;</li>
            <li>Gestão multi-unidade para redes hospitalares.</li>
          </ul>
          <p>
            A Plataforma é disponibilizada via interface web e aplicação móvel, sujeitas a actualizações
            periódicas sem aviso prévio, sempre que não impliquem redução material das funcionalidades contratadas.
          </p>
        </Legal.Section>

        <Legal.Section title="3. Conta e acesso">
          <p>
            O acesso à Plataforma requer a criação de uma conta institucional pelo administrador da organização
            Cliente. O Cliente é o único responsável por:
          </p>
          <ul>
            <li>Garantir a veracidade e actualidade dos dados de registo;</li>
            <li>Gerir e revogar acessos de utilizadores da sua organização;</li>
            <li>Manter confidenciais as credenciais de acesso;</li>
            <li>Comunicar imediatamente qualquer suspeita de acesso não autorizado.</li>
          </ul>
          <p>
            A MediScala reserva-se o direito de suspender contas em caso de violação destes Termos,
            uso abusivo ou não pagamento, após notificação com antecedência mínima de 5 dias úteis,
            excepto em situações de urgência ou violação grave.
          </p>
        </Legal.Section>

        <Legal.Section title="4. Licença de utilização">
          <p>
            A MediScala concede ao Cliente uma licença não exclusiva, intransmissível e limitada para
            utilizar a Plataforma exclusivamente para fins operacionais internos da sua organização, pelo
            período de subscrição activo.
          </p>
          <p>É expressamente proibido ao Cliente e seus utilizadores:</p>
          <ul>
            <li>Sublicenciar, revender ou ceder o acesso a terceiros;</li>
            <li>Efectuar engenharia reversa ou tentar extrair o código-fonte;</li>
            <li>Utilizar a Plataforma para fins ilícitos ou contrários à ordem pública angolana;</li>
            <li>Introduzir vírus, malware ou qualquer código malicioso;</li>
            <li>Sobrecarregar deliberadamente a infraestrutura técnica da Plataforma.</li>
          </ul>
        </Legal.Section>

        <Legal.Section title="5. Dados e propriedade">
          <p>
            Todos os dados operacionais introduzidos pelo Cliente na Plataforma (escalas, profissionais,
            ausências, etc.) permanecem propriedade exclusiva do Cliente. A MediScala não reivindica
            qualquer direito de propriedade sobre esses dados.
          </p>
          <p>
            Em caso de cessação contratual, o Cliente poderá solicitar a exportação dos seus dados em
            formato standard (CSV ou JSON) no prazo de 30 dias após o término. Decorrido esse prazo,
            os dados poderão ser eliminados dos servidores de produção.
          </p>
        </Legal.Section>

        <Legal.Section title="6. Disponibilidade e suporte">
          <p>
            A MediScala compromete-se a manter a Plataforma disponível, em condições normais de operação,
            com um objectivo de disponibilidade de 99,5% mensais, excluindo janelas de manutenção programada
            comunicadas com pelo menos 24 horas de antecedência.
          </p>
          <p>
            O suporte técnico é prestado por email e, mediante contrato, através de canal dedicado,
            no horário de segunda a sexta, 08h00–18h00 (WAT). Planos Enterprise beneficiam de SLA
            e suporte prioritário nos termos do respectivo contrato.
          </p>
        </Legal.Section>

        <Legal.Section title="7. Pagamentos e renovação">
          <p>
            As condições de preço e período de subscrição são definidas no contrato de serviço assinado
            entre a MediScala e o Cliente. A renovação é automática por períodos iguais, salvo comunicação
            de cancelamento com antecedência mínima de 30 dias.
          </p>
          <p>
            O não pagamento na data acordada pode resultar na suspensão do acesso após notificação.
            Valores em atraso superiores a 60 dias podem dar lugar à resolução do contrato e ao
            início de procedimentos de cobrança nos termos da lei angolana.
          </p>
        </Legal.Section>

        <Legal.Section title="8. Limitação de responsabilidade">
          <p>
            A MediScala não se responsabiliza por danos indirectos, lucros cessantes, perda de dados
            resultante de falha do Cliente em efectuar backups, ou decisões clínicas baseadas
            exclusivamente na informação da Plataforma.
          </p>
          <p>
            A responsabilidade total da MediScala perante o Cliente, por qualquer causa, fica limitada
            ao valor pago pelo Cliente nos 3 meses anteriores ao evento que originou a reclamação.
          </p>
        </Legal.Section>

        <Legal.Section title="9. Propriedade intelectual">
          <p>
            Toda a Plataforma, incluindo o seu código, design, marca, logótipos e documentação, é
            propriedade exclusiva da MediScala e encontra-se protegida pela legislação angolana e
            internacional sobre propriedade intelectual.
          </p>
          <p>
            Qualquer uso não autorizado da marca MediScala ou dos elementos visuais da Plataforma
            será tratado como violação e poderá dar origem a acção legal.
          </p>
        </Legal.Section>

        <Legal.Section title="10. Alterações aos Termos">
          <p>
            A MediScala pode actualizar estes Termos periodicamente. As alterações relevantes serão
            comunicadas por email com antecedência mínima de 15 dias. A continuação da utilização
            após esse prazo constitui aceitação das novas condições.
          </p>
        </Legal.Section>

        <Legal.Section title="11. Lei aplicável e foro">
          <p>
            Estes Termos são regidos pela lei angolana. Para a resolução de qualquer litígio decorrente
            da interpretação ou execução destes Termos, as partes elegem os tribunais judiciais da
            comarca de Luanda, com expressa renúncia a qualquer outro.
          </p>
        </Legal.Section>

        <Legal.Section title="12. Contacto">
          <p>
            Para questões relacionadas com estes Termos, contacte-nos através de:{" "}
            <a href="mailto:juridico@mediscala.co.ao" style={{ color: "#0F6E56", fontWeight: 600 }}>
              juridico@mediscala.co.ao
            </a>
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
