# QA Automation Lab — Agendamento Médico

[![API Tests](https://github.com/lucasfarias99/qa-automation-lab-agendamento-medico/actions/workflows/api-tests.yml/badge.svg)](https://github.com/lucasfarias99/qa-automation-lab-agendamento-medico/actions/workflows/api-tests.yml)

Projeto de portfólio de **automação de testes** sobre uma API de agendamento de consultas médicas.
A API foi construída do zero só para servir de sistema sob teste. Ela tem regras de negócio reais
o bastante para render testes interessantes: conflito de horário, grade de slots, prazo de cancelamento,
máquina de estados e concorrência.

O foco do projeto **não é a API**. O foco é a estratégia de testes em volta dela:

- **73 testes automatizados** (CT-001 a CT-071 + 2 smoke tests de infraestrutura) com Playwright + TypeScript
- Testes de **API**, de **contrato** (JSON Schema) e de **auditoria de banco** (consulta direta ao SQLite)
- **Isolamento de massa de teste** por `testRunId`, com expurgo ao final de cada teste
- **Teste de integridade sob concorrência** (duas reservas simultâneas no mesmo slot)
- **Pipeline CI** no GitHub Actions que falha se sobrar qualquer dado residual no banco

---

## Sumário

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Regras de negócio testadas](#regras-de-negócio-testadas)
- [Estratégia de testes](#estratégia-de-testes)
- [Cobertura por suite](#cobertura-por-suite)
- [Como rodar](#como-rodar)
- [Pipeline CI](#pipeline-ci)
- [Decisões técnicas](#decisões-técnicas)
- [Limitações conhecidas](#limitações-conhecidas)
- [Próximos passos](#próximos-passos)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Testes | Playwright Test (`APIRequestContext`), TypeScript |
| Contrato | AJV + `ajv-formats` (JSON Schema draft-07) |
| Auditoria de banco | `better-sqlite3` (leitura direta pelos testes) |
| API sob teste | Node.js 22, Express 5, Zod 4, SQLite |
| CI | GitHub Actions + relatórios HTML e JUnit do Playwright |

## Arquitetura

```
.
├── api/                    # API sob teste (Express + SQLite)
│   └── src/
│       ├── routes/         # definição de rotas
│       ├── controllers/    # camada HTTP (parse + status code)
│       ├── validators/     # schemas Zod dos payloads
│       ├── services/       # regras de negócio
│       ├── repositories/   # acesso ao SQLite
│       ├── errors/         # catálogo centralizado de códigos de erro
│       └── config/         # conexão, migrations e seed
├── schemas/                # JSON Schemas de contrato das respostas
├── tests/
│   ├── api/                # suites de API e contrato
│   ├── database/           # suite de auditoria direta no banco
│   ├── fixtures/           # payloads válidos com overrides
│   └── helpers/            # auth, cleanup, datas, db-client, schema-validator
├── scripts/
│   └── verify-db-clean.js  # gate do CI: banco precisa estar vazio após a suite
└── .github/workflows/      # pipeline de CI
```

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Health check (público) |
| `POST` | `/auth/register` | Cadastro de paciente (público) |
| `POST` | `/auth/login` | Login de paciente (público) |
| `GET` | `/doctors` | Lista médicos (filtro `?specialty=`) |
| `GET` | `/doctors/:id` | Consulta médico |
| `GET` | `/doctors/:id/slots?date=` | Slots disponíveis do médico na data |
| `POST` | `/appointments` | Cria agendamento |
| `GET` | `/appointments?testRunId=` | Lista agendamentos de um contexto de teste |
| `GET` | `/appointments/:id` | Consulta agendamento |
| `POST` | `/appointments/:id/cancel` | Cancela agendamento |
| `PATCH` | `/appointments/:id/status` | Atualiza status (`COMPLETED`, `NO_SHOW`...) |
| `DELETE` | `/test-data/appointments?testRunId=` | Expurga agendamentos de um contexto |
| `DELETE` | `/test-data/patients?testRunId=` | Expurga pacientes de um contexto |

Todas as rotas exceto `/health` e `/auth/*` exigem `Authorization: Bearer <API_TOKEN>`.

## Regras de negócio testadas

| Regra | Erro esperado |
|---|---|
| Médico não pode ter dois agendamentos ativos no mesmo horário | `409 SLOT_ALREADY_BOOKED` |
| Paciente não pode ter dois agendamentos no mesmo horário | `409 PATIENT_DOUBLE_BOOKING` |
| Horário precisa estar dentro do expediente do médico | `422 OUTSIDE_WORKING_HOURS` |
| Horário precisa estar alinhado à grade de slots (20, 30 ou 60 min) | `422 INVALID_SLOT_ALIGNMENT` |
| Não é permitido agendar no passado | `422 PAST_DATE_NOT_ALLOWED` |
| Médico inativo não recebe agendamentos | `422 DOCTOR_INACTIVE` |
| Cancelamento só com 24h de antecedência | `403 CANCELLATION_DEADLINE_EXCEEDED` |
| Status só sai de `SCHEDULED`; estados finais são imutáveis | `409 INVALID_STATUS_TRANSITION` |
| Slot cancelado volta a ficar disponível | — |

Máquina de estados do agendamento:

```
              ┌──► COMPLETED
SCHEDULED ────┼──► CANCELLED
              └──► NO_SHOW
```

Todo erro segue o mesmo formato, definido no catálogo em `api/src/errors/app-error.ts`
e validado pelo schema `schemas/error-response.schema.json`:

```json
{
  "code": "SLOT_ALREADY_BOOKED",
  "message": "Já existe um agendamento para este médico neste horário",
  "details": []
}
```

## Estratégia de testes

### 1. Isolamento de massa por `testRunId`

Cada teste gera um identificador único (`run_<timestamp>_<uuid>`) e grava esse ID em todo paciente e
agendamento que cria. No `afterEach`, o teste chama os endpoints `/test-data/*` para apagar
**apenas** o que ele mesmo criou, na ordem certa (agendamentos antes de pacientes, por causa da
chave estrangeira).

Por que isso importa:
- Testes não dependem uns dos outros nem da ordem de execução
- Dá para rodar em paralelo localmente sem um teste "ver" dados do outro
- O banco termina a suite exatamente como começou

### 2. Gate de banco limpo no CI

Depois da suite, `scripts/verify-db-clean.js` conta pacientes e agendamentos no banco. Se sobrar
qualquer registro, **o pipeline falha**. Na prática isso vira um teste do próprio cleanup: se alguém
escrever um teste novo e esquecer o expurgo, o CI denuncia.

### 3. Três camadas de verificação

| Camada | O que garante | Onde |
|---|---|---|
| **Comportamento** | Status code, código de erro e regra de negócio | `tests/api/*.spec.ts` |
| **Contrato** | Formato da resposta (campos, tipos, enums, `additionalProperties`) | `tests/api/appointments.contract.spec.ts` + `schemas/` |
| **Persistência** | O que a API diz que gravou é o que está de fato no banco | `tests/database/appointments.db-audit.spec.ts` |

A suite de banco existe porque uma resposta `201` não prova que o dado foi salvo corretamente.
Por exemplo, o CT-068 verifica que um agendamento **rejeitado** por conflito não deixou nenhum
registro parcial no SQLite.

### 4. Concorrência

O CT-032 dispara duas requisições ao mesmo tempo (`Promise.all`) para o mesmo médico e horário com
pacientes diferentes, e espera exatamente um `201` e um `409`. O CT-071 confirma no banco que só
existe um registro ativo para aquele slot.

> É um teste de **integridade sob concorrência**, não um teste de carga. Ele prova que a regra
> "um slot, um agendamento" se mantém quando duas requisições disputam o mesmo recurso.

### 5. Datas determinísticas

Os testes não usam datas fixas (que quebrariam com o tempo). `tests/helpers/date-helpers.ts` calcula
sempre o próximo dia útil a pelo menos 2 dias de distância, em UTC. Assim o agendamento nunca cai no
passado e fica fora da janela de 24h do cancelamento.

### Padrões de escrita

- Estrutura **Arrange / Act / Assert** em todos os testes
- Fixtures com `overrides` (`validPatientPayload(testRunId, { email: ... })`): o teste só declara o que importa para ele
- Cada teste tem um ID rastreável (`CT-0XX`) no título

## Cobertura por suite

| Suite | Arquivo | Casos |
|---|---|---|
| Health check | `health.spec.ts` | CT-001 |
| Autenticação | `auth.spec.ts` | CT-002 a CT-007 |
| Médicos | `doctors.spec.ts` | CT-008 a CT-012 |
| Slots | `doctors.slots.spec.ts` | CT-013 a CT-016 |
| Criação de agendamento | `appointments.create.spec.ts` | CT-017 a CT-024 |
| Regras de negócio | `appointments.business-rules.spec.ts` | CT-025 a CT-031 |
| Concorrência | `appointments.concurrency.spec.ts` | CT-032 |
| Consulta | `appointments.get.spec.ts` | CT-033 a CT-035 |
| Listagem | `appointments.list.spec.ts` | CT-036 a CT-038 |
| Cancelamento | `appointments.cancel.spec.ts` | CT-039 a CT-044 |
| Status | `appointments.status.spec.ts` | CT-045 a CT-050 |
| Expurgo de massa | `test-data.cleanup.spec.ts` | CT-051 a CT-055 |
| Contrato | `appointments.contract.spec.ts` | CT-056 a CT-064 |
| Auditoria de banco | `database/appointments.db-audit.spec.ts` | CT-065 a CT-071 |
| Smoke de infraestrutura | `infra-smoke.spec.ts` | INFRA-01, INFRA-02 |

## Como rodar

### Pré-requisitos

- Node.js 22+
- npm

### Setup

```bash
git clone https://github.com/lucasfarias99/qa-automation-lab-agendamento-medico.git
cd qa-automation-lab-agendamento-medico

npm install
npm --prefix api install

cp .env.example .env
npm run api:seed          # cria o banco e cadastra os 5 médicos
```

### Executando

Em um terminal, suba a API:

```bash
npm run api:dev
```

Em outro, rode os testes:

```bash
npm run test:backend      # API + banco (todas as suites atuais)
npm run test:api          # só API e contrato
npm run test:db           # só auditoria de banco
npm run db:verify-clean   # confere se o banco ficou limpo
npm run test:report       # abre o relatório HTML
```

Para recomeçar do zero: `npm run db:reset`.

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `API_PORT` | `3000` | Porta da API |
| `API_BASE_URL` | `http://localhost:3000` | `baseURL` dos testes |
| `API_TOKEN` | `qa-lab-token` | Token Bearer aceito pela API |
| `DB_PATH` | `./data/agendamento.db` | Caminho do SQLite (relativo à raiz) |
| `CANCELLATION_DEADLINE_HOURS` | `24` | Antecedência mínima para cancelar |

### Massa de dados (seed)

| ID | Médico | Especialidade | Expediente | Slot | Ativo |
|---|---|---|---|---|---|
| `doc_001` | Dra. Helena Prado | Cardiologia | 08:00–17:00 | 30 min | ✅ |
| `doc_002` | Dr. Rafael Nunes | Dermatologia | 09:00–15:00 | 30 min | ✅ |
| `doc_003` | Dra. Camila Rocha | Ortopedia | 07:00–13:00 | 60 min | ✅ |
| `doc_004` | Dr. Bruno Teixeira | Pediatria | 08:00–12:00 | 20 min | ✅ |
| `doc_005` | Dra. Sofia Almeida | Clínica Geral | 08:00–18:00 | 30 min | ❌ |

Os médicos têm grades diferentes de propósito, para exercitar as regras de expediente e de alinhamento
de slot com mais de um valor.

## Pipeline CI

O workflow `.github/workflows/api-tests.yml` roda a cada push e pull request:

```
checkout → setup Node 22 → npm ci → build da API → seed do banco
   → sobe a API em background → aguarda /health = UP
   → npm run test:backend → verify-db-clean
   → publica relatório HTML do Playwright e log da API como artefatos
```

No CI, o Playwright roda com `workers: 1`, `retries: 2`, `forbidOnly` ligado (um `test.only` esquecido
quebra o build) e trace gravado no primeiro retry.

## Decisões técnicas

**Por que construir a própria API?**
Com uma API pública eu não controlo o estado do banco nem consigo testar concorrência ou fazer
auditoria direta. Construindo a API, controlo as regras, o seed e o acesso ao banco, que é
justamente o que testes de integração de verdade precisam.

**Por que Playwright para testes de API?**
O `APIRequestContext` cobre bem testes de API, e a mesma ferramenta vai servir para a camada E2E
(planejada). É um único runner, um único relatório e uma única configuração de CI.

**Por que o banco garante a unicidade, e não só o código?**
O service checa conflito dentro de uma transação, mas a garantia final é um índice único parcial no
SQLite:

```sql
CREATE UNIQUE INDEX idx_unique_active_slot
  ON appointments (doctorId, scheduledAt)
  WHERE status = 'SCHEDULED';
```

O `WHERE status = 'SCHEDULED'` permite que um slot cancelado seja reaproveitado (CT-031) sem abrir
brecha para duplicidade.

**Por que endpoints `/test-data` dentro da API?**
Apagar dados direto pelo SQL dos testes acoplaria a suite ao schema do banco. Com endpoints, o
expurgo exige `testRunId` obrigatório (não existe "apagar tudo") e é ele mesmo testado (CT-051 a CT-055).

## Limitações conhecidas

Coisas que foram simplificadas de propósito, por se tratar de um laboratório de testes:

- **Autenticação**: as rotas protegidas aceitam um token Bearer fixo vindo de `.env`. Não há JWT,
  expiração nem vínculo entre token e paciente.
- **Senha**: o hash é um SHA-256 simples, sem salt. Em produção o certo seria `bcrypt`/`argon2`.
- **Fuso horário**: tudo é tratado em UTC, inclusive o expediente dos médicos.
- **Endpoints de teste**: `/test-data/*` não deveria existir em produção. O correto seria
  habilitá-los só por variável de ambiente.
- **Concorrência**: o SQLite serializa escritas num único processo. O teste prova a regra, mas não
  reproduz a contenção que um banco com várias conexões (ex.: PostgreSQL) teria.

## Próximos passos

- [ ] Front-end (`web-app/`) e suite **E2E** com Playwright + Page Objects (`tests/e2e`, `tests/pages`)
- [ ] Tag `@smoke` para uma suite rápida de regressão
- [ ] Relatório Allure publicado via GitHub Pages
- [ ] Rodar a API com PostgreSQL para um teste de concorrência mais realista

---

Feito por **Lucas Farias**: [GitHub](https://github.com/lucasfarias99)
