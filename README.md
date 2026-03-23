# Personal Finance

Sistema modular para centralização de fluxo de caixa e análise de investimentos com interface via Telegram.

## 🚀 Visão Geral

O **Personal Finance** é uma aplicação desenvolvida em NestJS focada em simplicidade e precisão. Ele permite que usuários gerenciem suas despesas e portfólio de investimentos (incluindo ativos de renda variável e criptoativos) diretamente através de um bot no Telegram, com suporte a processamento assíncrono de notas fiscais via OCR.

## 🛠️ Stack Tecnológica

- **Framework:** [NestJS](https://nestjs.com/) (Node.js)
- **Linguagem:** TypeScript
- **ORM:** [Prisma](https://www.prisma.io/) (PostgreSQL via Neon)
- **Banco de Dados:** PostgreSQL & Redis (BullMQ para processamento assíncrono)
- **Documentação:** MkDocs (Material Theme) & Swagger
- **Validação:** Zod

## 🏗️ Arquitetura

O projeto segue uma arquitetura modular dividida por domínios:

- **Expenses:** Gestão de fluxo de caixa e despesas diárias.
- **Investments:** Controle de portfólio e cálculo de Preço Médio (PM).
- **Market:** Integração com APIs de dados de mercado financeiro.
- **Processor:** Processamento de tarefas pesadas (OCR/Tesseract.js).
- **Telegram:** Interface principal de interação com o usuário.

## 🔧 Como Iniciar (Desenvolvimento)

O projeto está totalmente containerizado para facilitar o setup inicial.

### Pré-requisitos
- Docker e Docker Compose instalados.

### Passo a Passo

1. **Clonar o repositório:**
   ```bash
   git clone <repo-url>
   cd personal_finance
   ```

2. **Configurar variáveis de ambiente:**
   ```bash
   cp .env.example .env # Se disponível, ou configure o DATABASE_URL e REDIS_URL
   ```

3. **Subir o ambiente com Docker:**
   ```bash
   docker compose up --build
   ```
   *O container da aplicação rodará automaticamente os testes e iniciará em **watch mode**.*

4. **Acessar a documentação:**
   - **Swagger:** `http://localhost:3000/docs`
   - **MkDocs:** `mkdocs serve` (localmente em `http://localhost:8000`)

## 🧪 Testes e Qualidade

- **Testes:** `npm run test` (unitários) ou `npm run test:e2e` (integração).
- **Linting:** O projeto utiliza ESLint, Markdownlint e Commitlint (Husky) para garantir a qualidade do código e do histórico do Git.

---
*Este projeto segue rigorosamente as diretrizes definidas no `GEMINI.md`.*
