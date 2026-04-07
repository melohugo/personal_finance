# Modelagem de Dados

A persistência de dados foi projetada para garantir a integridade transacional e a precisão matemática necessária para cálculos financeiros complexos, como o Preço Médio de ativos com alta volatilidade e diferentes casas decimais (ex: Bitcoin).

## Modelo Entidade-Relacionamento (MER)

**O que modela:** As relações conceituais entre as entidades do sistema.

**Como funciona:** O modelo estabelece o usuário como o nó central de isolamento de dados. Cada usuário possui seus próprios registros de gastos e sua carteira de ativos independente. A relação entre ativos e operações permite que o histórico de movimentações seja preservado, possibilitando auditorias e reconstrução de saldos históricos.

```mermaid
erDiagram
    USUARIO ||--o{ CATEGORIA : define
    USUARIO ||--o{ GASTO : registra
    CATEGORIA ||--o{ GASTO : categoriza
    USUARIO ||--o{ ATIVO : detem
    ATIVO ||--o{ OPERACAO_ATIVO : possui

    USUARIO {
        bigint telegram_id
    }
    CATEGORIA {
        string id
        string nome
    }
    GASTO {
        decimal valor
        datetime data
        string descricao
    }
    ATIVO {
        string ticker
        string tipo
        string moeda
    }
    OPERACAO_ATIVO {
        decimal quantidade
        decimal preco_unitario
        string tipo_operacao
        datetime data
    }
```

## Diagrama Lógico de Dados (DLD)

**O que modela:** A estrutura física das tabelas, chaves primárias (PK), chaves estrangeiras (FK) e os tipos de dados compatíveis com o PostgreSQL e o ambiente de execução NestJS.

**Como funciona:** Utiliza-se o tipo numeric para campos monetários e de quantidade para evitar erros de precisão de ponto flutuante. Chaves do tipo uuid são empregadas para transações, enquanto bigint é utilizado para o identificador do Telegram para suportar a escala numérica da API externa.

```mermaid
erDiagram
    users ||--o{ categories : "telegram_id"
    users ||--o{ expenses : "telegram_id"
    categories ||--o{ expenses : "category_id"
    users ||--o{ assets : "telegram_id" (indireto)
    users ||--o{ asset_operations : "telegram_id"
    assets ||--o{ asset_operations : "asset_id"

    users {
        bigint telegram_id PK
        timestamp created_at
        timestamp updated_at
    }

    categories {
        uuid id PK
        varchar name
        bigint telegram_id FK
    }

    expenses {
        uuid id PK
        bigint telegram_id FK
        numeric amount
        uuid category_id FK
        timestamp date
        text description
    }

    assets {
        uuid id PK
        varchar ticker
        varchar asset_type
        varchar currency
    }

    asset_operations {
        uuid id PK
        bigint telegram_id FK
        uuid asset_id FK
        numeric quantity
        numeric unit_price
        varchar operation_type
        timestamp date
    }
```

## Dicionário de Dados

Abaixo estão detalhadas as restrições e finalidades dos principais atributos do sistema:

| Atributo | Detalhes Técnicos | Descrição |
| :--- | :--- | :--- |
| **expenses.amount** | `DECIMAL(18, 8)` | Valor da transação com precisão para 8 casas decimais. |
| **asset_operations.quantity** | `DECIMAL(18, 8)` | Quantidade de ativos operada. |
| **asset_operations.unit_price** | `DECIMAL(18, 8)` | Preço unitário no momento da operação. |
| **categories.name** | `VARCHAR` | Nome da categoria (ex: Alimentação, Saúde). |
| **assets.asset_type** | `ENUM` | Classificação do ativo: STOCK, CRYPTO, REIT, FIAGRO. |
| **assets.currency** | `ENUM` | Moeda de origem do ativo: BRL ou USD. |
| **asset_operations.operation_type** | `ENUM` | Define se a movimentação é de BUY ou SELL. |
