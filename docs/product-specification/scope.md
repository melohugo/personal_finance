# Especificação de Escopo

**Objetivo:** Centralizar o controle de fluxo de caixa e análise de ativos financeiros.

---

## 1. Objetivo do Projeto
Criar uma solução automatizada para o monitoramento de finanças pessoais que reduza o esforço manual de registro de despesas e forneça suporte à decisão de investimentos através de análises fundamentadas em metodologias clássicas de Value Investing.

---

## 2. Funcionalidades (O que será feito)

### 2.1. Módulo de Gestão de Fluxo de Caixa
* **Interface de Mensageria:** Registro de movimentações financeiras via comandos de texto ou linguagem natural em interface de bot.
* **Processamento Automatizado de Documentos:** Leitura e extração de dados de faturas de cartão de crédito e comprovantes.
* **Classificação Dinâmica:** Categorização de gastos baseada no histórico e descrição da transação.
* **Cálculo de Capacidade de Investimento:** Dedução automática do valor disponível para aporte mensal após despesas fixas e variáveis.

### 2.2. Módulo de Inteligência em Investimentos
* **Análise de Ativos (Bolsa de Valores e Criptoativos):** Consulta de dados de mercado para ativos específicos.
* **Triagem Quantitativa Automática:** Cálculo de indicadores de preço justo, margem de segurança e rentabilidade (ROE, P/L, Valor Intrínseco).
* **Análise Qualitativa de Relatórios:** Summarização de fatos relevantes e documentos oficiais de empresas/fundos, destacando riscos, vantagens competitivas e projeções.
* **Gestão de Carteira e Rebalanceamento:** Monitoramento da alocação atual vs. alocação alvo, com sugestões de compra para manter o equilíbrio da estratégia.

### 2.3. Relatórios e Alertas
* **Fechamento Semanal:** Resumo de notícias do mercado e atualizações dos ativos presentes na carteira.
* **Alertas de Oportunidade:** Notificação quando um ativo monitorado atinge critérios pré-definidos de compra (margem de segurança).

---

## 3. Fora de Escopo (O que NÃO será feito)

* **Intermediação Financeira:** O sistema não realizará transações bancárias ou envio de ordens de compra/venda para corretoras.
* **Gestão Tributária:** Não haverá geração de guias de impostos (DARF) ou declaração de IR.
* **Análise Técnica/Gráfica:** O sistema não processará indicadores baseados em histórico de preços (médias móveis, candles, etc.).
* **Acesso Multiusuário:** O sistema será projetado para um único perfil de usuário.

---

## 4. Entregáveis

1.  **Núcleo de Processamento:** Motor de regras financeiras e lógica de análise de investimentos.
2.  **Interface de Bot:** Canal de interação para entrada de dados e recebimento de alertas.
3.  **Interface de Terminal (CLI):** Ferramenta para consulta rápida de dados via linha de comando.
4.  **Base de Conhecimento:** Estrutura de armazenamento de dados históricos de gastos e ativos.

---

## 5. Restrições e Premissas

* **Disponibilidade de Dados:** O sistema depende da existência de fontes de dados públicas ou gratuitas para cotações e documentos oficiais (CVM/B3).
* **Privacidade:** Todas as informações financeiras devem ser tratadas como dados sensíveis e armazenadas em ambiente controlado pelo usuário.
* **Independência Tecnológica:** A lógica de negócio deve ser agnóstica o suficiente para permitir troca de componentes de interface ou banco de dados no futuro.

---

## 6. Riscos

* **Alteração em Layouts de Terceiros:** Mudanças nos formatos de documentos bancários podem exigir reajustes nos parsers.
* **Volatilidade de APIs:** Dependência de serviços externos para obtenção de indicadores de mercado em tempo real.
