# Serennia Backend

API REST para o sistema de gestão de salões de beleza Serennia.

## 🛠️ Tecnologias

- **Node.js** com TypeScript
- **Express** como framework HTTP
- **Prisma ORM** para acesso ao banco de dados
- **PostgreSQL** como banco de dados (via Supabase)
- **Supabase Auth** para autenticação
- **Nodemailer** para envio de emails

## 📋 Pré-requisitos

- Node.js >= 18
- npm ou pnpm
- PostgreSQL (recomendado via Supabase)
- Conta no Supabase para autenticação

## 🚀 Instalação

1. **Clone o repositório e entre na pasta:**

```bash
cd serennia-backend
```

2. **Instale as dependências:**

```bash
npm install
```

3. **Configure as variáveis de ambiente:**

Crie um arquivo `.env` na raiz do projeto:

```env
# Banco de Dados
DATABASE_URL=postgresql://user:password@host:5432/database

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Servidor
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
EMAIL_FROM=Serennia <noreply@serennia.app>
```

4. **Execute as migrações do banco de dados:**

```bash
npx prisma migrate deploy
npx prisma generate
```

5. **Inicie o servidor de desenvolvimento:**

```bash
npm run dev
```

A API estará disponível em `http://localhost:4000`.

## 📜 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia em modo desenvolvimento com hot-reload |
| `npm run build` | Compila o TypeScript para produção |
| `npm start` | Inicia o servidor compilado |
| `npm run kill:port` | Libera a porta 4000 se estiver em uso |
| `npm run dev:clean` | Limpa a porta e inicia o servidor |

## 📁 Estrutura do Projeto

```
src/
├── index.ts              # Entry point da aplicação
├── prismaClient.ts       # Cliente Prisma
├── salonContext.ts       # Contexto e mapeamento do salão
├── middleware/           # Middlewares (auth, rate limiting, errors)
├── routes/               # Rotas da API
│   ├── appointments.ts   # Agendamentos
│   ├── auth.ts           # Autenticação
│   ├── categories.ts     # Categorias
│   ├── clients.ts        # Clientes
│   ├── collaborators.ts  # Colaboradores
│   ├── expenses.ts       # Custos/Despesas
│   ├── messages.ts       # Templates de mensagens
│   ├── notifications.ts  # Notificações
│   ├── orders.ts         # Comandas
│   ├── products.ts       # Produtos
│   ├── register.ts       # Registro de salões
│   ├── services.ts       # Serviços
│   └── totem.ts          # API do totem
├── lib/                  # Bibliotecas auxiliares
│   ├── email.ts          # Envio de emails
│   └── supabase.ts       # Cliente Supabase Admin
├── services/             # Serviços externos
│   └── whatsapp.ts       # Integração WhatsApp
├── types/                # Tipos TypeScript
│   └── enums.ts          # Enums da aplicação
├── utils/                # Utilitários
│   └── validation.ts     # Validação de dados
└── scripts/              # Scripts de manutenção
    ├── createSuperAdmin.ts
    ├── createInitialUsers.ts
    └── migrateUsersToSupabase.ts
```

## 🔗 Endpoints Principais

### Autenticação
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `GET /auth/me` - Usuário atual

### Recursos
- `GET/POST /clients` - Clientes
- `GET/POST /collaborators` - Colaboradores
- `GET/POST /services` - Serviços
- `GET/POST /products` - Produtos
- `GET/POST /appointments` - Agendamentos
- `GET/POST /orders` - Comandas
- `GET/POST /expenses` - Custos/Despesas
- `GET/PATCH /salon` - Configurações do salão
- `GET/POST/PATCH/DELETE /messages/templates` - Templates de mensagens

### Health Check
- `GET /health` - Status da API e banco

## 🔐 Autenticação

A API usa autenticação via JWT do Supabase. Todas as rotas protegidas requerem o header:

```
Authorization: Bearer <token>
```

### Roles do Sistema

- **super_admin**: Acesso total ao sistema
- **tenant_admin**: Administrador do salão
- **manager**: Gerente
- **receptionist**: Recepcionista
- **professional**: Profissional
- **accountant**: Contador

## 📊 Banco de Dados

O schema Prisma inclui:

- **Salon**: Salões com configurações de tema e permissões
- **User**: Usuários autenticados
- **Client**: Clientes do salão
- **Collaborator**: Colaboradores (profissionais, gerentes, etc.)
- **Service/Product**: Catálogo de serviços e produtos
- **Category**: Categorias
- **Appointment**: Agendamentos
- **Order/OrderItem**: Comandas e itens
- **Payment**: Pagamentos
- **Expense**: Custos fixos e variáveis
- **MessageTemplate/MessageLog**: Templates e logs de mensagens
- **CommissionRecord**: Registros de comissões
- **AuditLog**: Logs de auditoria
- **Notification**: Notificações

## 🔧 Criação de Super Admin

Para criar o primeiro super admin:

```bash
npx ts-node src/scripts/createSuperAdmin.ts
```

## 🌐 Deploy

1. Compile o projeto:
```bash
npm run build
```

2. Inicie em produção:
```bash
npm start
```

Recomendado usar PM2 ou similar para gerenciamento de processos.

## 📄 Licença

Projeto proprietário - Todos os direitos reservados.

