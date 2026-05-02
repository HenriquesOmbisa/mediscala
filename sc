## Como Rodar e Usar

### 1. Pré-requisitos
```bash
# Iniciar PostgreSQL e Redis (Docker)
bun run dev:services
```

### 2. Inicializar a Base de Dados Master (primeira vez)
```bash
cd apps/api

# Cria o DB mediscala_master, tabelas, planos padrão + Super Admin
bun run db:init-master --email admin@mediscala.ao --password SenhaSegura@123
```

### 3. Criar o primeiro tenant (empresa/hospital)
```bash
# Cria DB mediscala_demo + admin do tenant
bun run db:create-tenant \
  --name "Hospital Demo" \
  --slug demo \
  --admin-email admin@hospital.demo \
  --admin-password Admin@1234 \
  --admin-name "Dr. Admin" \
  --plan STARTER
```

**Ou usar o seed de demonstração** (cria tenant `demo` com dados):
```bash
bun run db:seed
```

### 4. Iniciar os servidores
```bash
# Da raiz do monorepo — inicia API + Web + Admin em paralelo
bun run dev
```

| App | URL | Descrição |
|-----|-----|-----------|
| API | http://localhost:3001 | Backend Fastify |
| Web | http://localhost:5173 | App dos hospitais |
| Admin | http://localhost:5174 | Painel de administração |

### 5. Aceder ao painel Admin
Abrir **http://localhost:5174** → login com as credenciais criadas no passo 2.

### 6. Aceder à app Web (hospital)
Abrir **http://localhost:5173** → login com o admin do tenant (passo 3).

---

### Comandos úteis

```bash
# Forçar um tenant específico para dev (sem precisar de JWT correcto)
cd apps/api
bun run db:force-tenant demo

# Limpar o force tenant
bun run db:force-tenant --clear

# Criar mais empresas
bun run db:create-tenant --name "Clínica XYZ" --slug clinica-xyz \
  --admin-email admin@clinica.xyz --admin-password Senha@123 --plan PROFESSIONAL
```

### Credenciais do seed de demo
| Email | Senha | Role |
|-------|-------|------|
| `admin@mediscala.demo` | `Admin@1234` | HOSPITAL_ADMIN |
| `manager@mediscala.demo` | `Demo@1234` | MANAGER |
| `colaborador1@mediscala.demo` | `Demo@1234` | COLLABORATOR |