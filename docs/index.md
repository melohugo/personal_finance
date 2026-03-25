# Personal Finance

O **Personal Finance** é uma solução para o controle de finanças pessoais e acompanhamento de investimentos, operada integralmente por meio da interface do **Telegram**.

O projeto tem como objetivo centralizar a gestão financeira em uma plataforma de alta disponibilidade e fácil acesso, eliminando a necessidade de preenchimento manual de planilhas ou a utilização de múltiplos aplicativos. Através de um bot especializado, o sistema permite o registro de fluxos de caixa e o monitoramento de ativos de forma ágil e segura.

---

## Funcionalidades Principais

### Registro Automatizado via OCR

O sistema utiliza reconhecimento óptico de caracteres para processar fotos de notas fiscais e recibos. Esta funcionalidade extrai automaticamente valores e metadados, sugerindo categorizações de gastos com base no histórico do usuário e reduzindo o esforço de entrada de dados.

### Gestão de Ativos e Investimentos

A plataforma oferece uma visão consolidada do patrimônio, integrando-se a provedores de dados de mercado. O sistema realiza o cálculo automatizado de Preço Médio (PM) e Lucro/Prejuízo (P&L) para ativos de renda variável da B3 (Ações e FIIs) e ativos digitais (Bitcoin).

### Relatórios Analíticos

Geração de demonstrativos sobre a saúde financeira e performance da carteira diretamente no chat. Os dados são estruturados para facilitar a análise do fluxo de caixa e auxiliar na tomada de decisões estratégicas de investimento.

---

## Estrutura Técnica

A aplicação foi desenvolvida focando em modularidade e resiliência:

* **Backend:** Construído com o framework **NestJS**, seguindo padrões de arquitetura modular para facilitar a manutenção e escalabilidade.
* **Processamento:** Implementação de arquitetura orientada a eventos com filas para o processamento de imagens, garantindo que operações de alto custo computacional não comprometam a responsividade da interface.
* **Integrações:** Consumo de APIs externas para atualização de cotações e indicadores financeiros em tempo real.
