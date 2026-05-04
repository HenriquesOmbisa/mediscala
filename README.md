# MediScala

Plataforma de gestao de escalas hospitalares com arquitetura multi-tenant, painel web para clientes (hospitais), app mobile, API central e painel admin para operacao SaaS.

## 1. Visao Geral

MediScala e um monorepo com os seguintes apps:

- `apps/api`: backend Fastify + PostgreSQL + Redis
- `apps/web`: painel web do cliente (hospital)
- `apps/admin`: painel administrativo SaaS (super admin)
- `apps/site`: frontend publico (landing e paginas institucionais)
- `apps/mobile`: app mobile Expo
- `packages/shared`: schemas/tipos compartilhados

A arquitetura de dados e **database-per-tenant**:

- `mediscala_master`: metadados globais (tenants, planos, subscricoes, pagamentos, super admins)
- `mediscala_<slug>`: base isolada de cada cliente

## 2. Stack Tecnica

### Backend

- Bun (dev runtime)
- Fastify 5
- PostgreSQL (`pg` + Drizzle ORM)
- Redis + BullMQ
- JWT + refresh token
- Argon2 para hash de senha
- Uploads locais (`/uploads`)

### Frontend

- Web cliente: React + Vite + TanStack Router + TanStack Query
- Admin: React + Vite + React Router + TanStack Query
- Mobile: Expo + React Native

### Monorepo

- Turborepo
- Workspaces via Bun

## 3. Estrutura do Monorepo

```text
apps/
  api/
  web/
  admin/
  mobile/
packages/
  shared/
```

## 4. Requisitos

- Bun 1.3+
- Docker + Docker Compose
- Node.js 20+ (opcional para algumas ferramentas)

## 5. Setup Rapido (Primeira Execucao)

### 5.1 Instalar dependencias

Na raiz do projeto:

```bash
bun install
```

### 5.2 Subir infra local (Postgres + Redis)

```bash
bun run dev:services
```

Portas locais usadas no desenvolvimento:

- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`

### 5.3 Configurar API

Arquivo de ambiente em `apps/api/.env`:

```env
MASTER_DATABASE_URL=postgresql://mediscala:mediscala@localhost:5433/mediscala_master
REDIS_URL=redis://localhost:6380
JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,exp://localhost:8081
APP_TIMEZONE=Africa/Luanda
# FORCE_TENANT_SLUG=demo
```

### 5.4 Inicializar base master e super admin

```bash
cd apps/api
bun run db:init-master --email admin@mediscala.ao --password SenhaSegura@123
```

### 5.5 Criar tenant inicial

```bash
bun run db:create-tenant \
  --name "Hospital Demo" \
  --slug demo \
  --admin-email admin@hospital.demo \
  --admin-password Admin@1234 \
  --admin-name "Dr. Admin" \
  --plan STARTER
```

### 5.6 Rodar tudo

Na raiz:

```bash
bun run dev
```

Apps locais:

- API: `http://localhost:3001`
- Web cliente: `http://localhost:5173`
- Admin: `http://localhost:5174`
- Site publico: `http://localhost:5175`
- Mobile (Expo): Metro em `:8081`

## 6. Scripts Importantes

## 6.1 Raiz

- `bun run dev`: sobe todos os apps via Turbo
- `bun run dev:services`: sobe Postgres/Redis de desenvolvimento
- `bun run dev:services:down`: derruba servicos
- `bun run dev:full`: servicos + apps
- `bun run build`: build de todo monorepo
- `bun run type-check`: type-check de todo monorepo
- `bun run lint`: lint em todo monorepo

## 6.2 API (`apps/api`)

- `bun run dev`
- `bun run build`
- `bun run type-check`
- `bun run db:init-master`
- `bun run db:create-tenant`
- `bun run db:force-tenant`
- `bun run db:seed`

### Nota sobre `db:generate`

Se voce executar `bun run db:generate`, pode falhar porque este script nao esta definido no `package.json` da API.
Use os scripts existentes ou rode Drizzle manualmente via `bunx drizzle-kit ...` quando necessario.

## 7. Fluxo Multi-Tenant

1. Super admin cria tenant no master
2. Sistema provisiona `mediscala_<slug>`
3. Cria admin hospitalar no banco do tenant
4. Registra lookup global (`user_lookups`)
5. Login resolve tenant por email lookup

## 8. Billing (Cliente e Admin)

## 8.1 Cliente (Web)

Rotas de billing no web:

- `/dashboard/billing/plan`: plano atual e limites
- `/dashboard/billing/payments`: historico e status
- `/dashboard/billing/upgrade`: selecao de plano + submissao de pagamento

Endpoints tenant billing (API):

- `GET /api/v1/billing/current-plan`
- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/payments`
- `POST /api/v1/billing/payments/submit`

Submissao exige comprovativo (jpeg/png/webp/pdf).

## 8.2 Admin

Fluxo administrativo no painel:

- visualizar pagamentos submetidos
- aprovar ou rejeitar submissao
- ao aprovar: liberar plano automaticamente

Endpoints admin de pagamentos:

- `GET /api/v1/admin/payments`
- `POST /api/v1/admin/payments/:id/approve`
- `POST /api/v1/admin/payments/:id/reject`

Status de submissao:

- `SUBMITTED`
- `APPROVED`
- `REJECTED`

## 9. Auth e Seguranca

- Access token JWT (curta duracao)
- Refresh token via cookie
- RBAC por papel (`SUPER_ADMIN`, `HOSPITAL_ADMIN`, `MANAGER`, `COLLABORATOR`)
- `FORCE_TENANT_SLUG` para debug local (somente dev)

## 10. Troubleshooting

## 10.1 Erro Redis `ECONNREFUSED 127.0.0.1:6380`

Causa comum: servicos Docker nao iniciados.

Solucao:

```bash
bun run dev:services
```

Verificar status:

```bash
docker compose -f docker-compose.dev.yml ps
```

## 10.2 Erro de autenticacao no Postgres

Cheque se a URL aponta para `5433` (dev compose) e credenciais `mediscala:mediscala`.

## 10.3 Login admin nao avanca

Verifique:

- super admin criado com `db:init-master`
- API em execucao
- token salvo no estado do admin
- resposta backend com `data.accessToken`

## 10.4 Crash frontend `map/filter is not a function`

Geralmente ocorre por parse incorreto de payload API.
Padrao esperado no projeto: normalizar `response.data?.data ?? response.data`.

## 10.5 Mobile encerra com SIGHUP

Se API falhar no `turbo dev`, o pipeline inteiro pode interromper.
Garanta que Postgres/Redis estejam ativos antes de subir tudo.

## 11. Comandos de Operacao do Tenant

Forcar tenant em dev (debug):

```bash
cd apps/api
bun run db:force-tenant demo
```

Limpar force:

```bash
bun run db:force-tenant --clear
```

## 12. Build e Deploy (Resumo)

Fluxo recomendado:

1. `bun run type-check`
2. `bun run lint`
3. `bun run build`

Para producao:

- usar Dockerfiles de `apps/api` e `apps/web`
- configurar variaveis seguras
- usar storage externo para uploads
- usar Redis e Postgres gerenciados

## 13. Roadmap Tecnico Sugerido

- Error boundary global no admin e web
- Padronizar contratos de resposta da API
- Observabilidade (logs estruturados + metricas)
- Auditoria completa de billing (quem aprovou/rejeitou e quando)
- Notificacoes proativas para aprovacao/rejeicao de pagamento

## 14. Convencoes

- TypeScript estrito
- Evitar logica de negocio no frontend
- Sempre validar payload no backend
- Em listas de API: tratar fallback de payload com seguranca

## 15. Licenca

Definir conforme estrategia do projeto.
