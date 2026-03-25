# Histórias de Usuário

Este documento detalha as necessidades do usuário e os critérios de aceitação para validar a entrega de cada funcionalidade do MVP.

---

## 1. Gestão de Fluxo de Caixa (Financeiro)

### US01: Registro de Gastos por Mensagem

**História:** Eu, como usuário, quero cadastrar meus gastos via mensagem de texto rápida para que eu não perca o registro de pequenas despesas diárias.

* **Critérios de Aceitação:**
  * O sistema deve processar entradas em linguagem natural (ex: "Gastei 50 no almoço").
  * O sistema deve identificar e confirmar: Valor, Categoria e Data.
  * Deve permitir a alteração da categoria caso a classificação automática esteja incorreta.

### US02: Importação de Extrato ou Fatura

**História:** Eu, como usuário, quero enviar o arquivo de extrato ou fatura (PDF/CSV) para registrar múltiplos gastos de uma vez sem digitação manual.

* **Critérios de Aceitação:**
  * O sistema deve ler e extrair transações de arquivos PDF (faturas de cartão).
  * O sistema deve identificar gastos duplicados (mesmo valor, data e local) para evitar registros repetidos.
  * O sistema deve apresentar um resumo final: "X gastos importados, totalizando R$ Y".

### US03: Visualização por Categoria

**História:** Eu, como usuário, quero visualizar meus gastos mensais agrupados por categoria para saber quanto estou gastando em cada área.

* **Critérios de Aceitação:**
  * O sistema deve exibir o total gasto no mês e a divisão por categorias (ex: Lazer, Alimentação, Contas Fixas).
  * O usuário deve poder solicitar o relatório de um mês específico.

### US04: Histórico de Gastos

**História:** Eu, como usuário, quero visualizar o histórico dos meus gastos para poder analisar meus hábitos de consumo.

* **Critérios de Aceitação:**
  * O sistema deve listar as últimas transações de forma cronológica.
  * Deve permitir a filtragem por palavras-chave (ex: buscar todos os gastos em "Posto").

### US05: Previsão de Aporte (Capacidade de Investimento)

**História:** Eu, como usuário, quero prever o quanto eu posso investir por mês para poder me planejar financeiramente.

* **Critérios de Aceitação:**
  * O sistema deve calcular o saldo disponível com base na renda cadastrada menos os gastos registrados no mês.
  * O sistema deve projetar o valor final de aporte considerando a média de gastos fixos.

---

## 2. Gestão de Investimentos

## US06: Gestão de Ativos na Carteira

**História:** Eu, como usuário, quero adicionar ou editar ativos na minha carteira para acompanhar meu patrimônio atualizado.

* **Critérios de Aceitação:**
  * Deve permitir a inclusão de Tickers (Ações/FIIs) e Criptoativos (BTC/ETH).
  * Deve permitir atualizar a quantidade total de um ativo específico.

### US07: Relatórios Semanais de Acompanhamento

**História:** Eu, como usuário, quero receber relatórios semanais de ativos da minha carteira para me manter informado sobre notícias e variações.

* **Critérios de Aceitação:**
  * O relatório deve ser enviado automaticamente em dia/hora pré-definido.
  * Deve conter resumos de Fatos Relevantes ou notícias macro que impactem os ativos da carteira.

### US08: Recomendações e Rebalanceamento Mensal

**História:** Eu, como usuário, quero receber recomendações mensais para minha carteira para poder balancear os ativos e mantê-la saudável.

* **Critérios de Aceitação:**
  * O sistema deve sugerir onde alocar o "Aporte do Mês" com base na estratégia definida.
  * As recomendações devem priorizar ativos que estão abaixo do Valor Intrínseco calculado.

### US09: Alertas de Oportunidade

**História:** Eu, como usuário, quero receber alertas de oportunidades de ativos que podem fazer parte da minha carteira para eu aumentar meus rendimentos.

* **Critérios de Aceitação:**
  * O alerta deve ser disparado quando um ativo monitorado atingir uma margem de segurança específica (ex: Desconto de 20% sobre o valor justo).
  * O alerta deve justificar a oportunidade (ex: "Dividend Yield acima da média histórica").

---

## 3. Persistência e Segurança

### US10: Exportação de Dados (Backup)

**História:** Eu, como usuário, quero poder exportar meus dados para garantir que minhas informações financeiras não fiquem presas ao sistema.

* **Critérios de Aceitação:**
  * Geração de um arquivo CSV ou Excel com todas as transações de gastos e posição atual da carteira.
