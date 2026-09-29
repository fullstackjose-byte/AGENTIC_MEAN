# Prueba técnica replanteada: Ecosistema de Agentes para Help Desk

**Versión:** 2.0  
**Fuente:** `Prueba_Tecnica_Ecosistema_Agentes_HelpDesk (1) (2).pdf`  
**Tecnología principal obligatoria:** Node.js  
**Estrategia de desarrollo obligatoria:** TDD (prueba roja, implementación mínima, refactorización)

### Estado de implementación

**Avance actual:** el agente de triage ya está implementado de extremo a extremo. Incluye puerto de modelo desacoplado, proveedor mock determinista, política de prioridad, reglas de escalamiento, persistencia de clasificaciones, endpoint HTTP, botón en Angular, migración Prisma y pruebas unitarias/E2E. No requiere una API key de OpenAI.

El agente de diagnóstico VPN también está implementado en modo mock: valida el handoff, sanitiza el error, produce evidencia DNS/TCP, persiste la ejecución y escala fallos de herramienta. La API dispone de Swagger UI en `/docs` y del contrato OpenAPI en `/docs-json`.

El flujo de remediación está implementado con allowlist y aprobación humana: las acciones de bajo riesgo se ejecutan y verifican automáticamente en modo mock, las de riesgo medio pasan a `PENDING_APPROVAL`, y las prohibidas se rechazan. Angular incluye una bandeja de aprobaciones y la resolución exige evidencia de verificación exitosa.

La auditoría append-only y el ciclo final también están implementados. Cada creación, clasificación, diagnóstico, remediación, decisión, resolución, cierre y reapertura genera un evento sanitizado. PostgreSQL bloquea por trigger cualquier `UPDATE` o `DELETE` sobre `audit_events`; Angular y Swagger permiten consultar la línea de tiempo, cerrar y reabrir tickets.

La autorización RBAC cuenta con dos adaptadores seleccionables: identidad mock para desarrollo (`AUTH_MODE=mock`) y JWT/OIDC real (`AUTH_MODE=oidc`). El modo OIDC valida firma mediante JWKS, issuer, audience, expiración, algoritmo, subject y rol antes de aplicar permisos. Los actores auditados se toman de la identidad verificada y los usuarios finales solo pueden consultar sus propios tickets. Swagger expone tanto las credenciales mock como Bearer JWT.

La base ejecutable ya incluye Angular, NestJS, PostgreSQL + pgvector, Prisma ORM, migración versionada, creación/listado/consulta de tickets, redacción previa a persistencia, pruebas unitarias y prueba E2E. El flujo real de `postCreateCommand` y `postStartCommand` fue validado dentro del Dev Container.

## 1. Objetivo

Diseñar e implementar una solución funcional de soporte técnico automatizado para una mesa de ayuda. La solución recibirá solicitudes en lenguaje natural, clasificará y priorizará tickets, ejecutará diagnósticos y remediaciones seguras, escalará casos ambiguos y conservará una bitácora auditable.

La personalización de agentes debe materializarse mediante Custom Instructions, Agent Skills, Custom Agents con handoffs y Prompt Files compatibles con el ecosistema de asistentes de VS Code.

## 2. Decisiones no negociables

1. **Node.js es la tecnología principal**, tal como exige el nuevo PDF.
2. El frontend se desarrollará con Angular y arquitectura feature-first por capas.
3. El backend se desarrollará con NestJS y Clean Architecture.
4. PostgreSQL con pgvector será la única fuente de verdad persistente.
5. La solución se levantará con Docker Compose y podrá abrirse mediante **Reopen in Container**.
6. Todo comportamiento nuevo comenzará por una prueba unitaria que falle.
7. Las pruebas unitarias no harán llamadas de red, no utilizarán una base de datos real y no consumirán una API de IA.
8. No se almacenarán credenciales, tokens, secretos ni PII en texto plano.
9. Los handoffs serán deterministas, acotados y sin ciclos.
10. Ninguna respuesta de un modelo podrá modificar datos sin validación del backend.

## 3. Stack tecnológico

| Área | Tecnología | Decisión |
|---|---|---|
| Runtime principal | Node.js LTS | Obligatorio por el PDF |
| Lenguaje | TypeScript strict | Frontend, backend, scripts y pruebas |
| Monorepo | pnpm workspaces | Dependencias y comandos unificados |
| Frontend | Angular LTS + Angular Material | Portal de usuario y consola de soporte |
| Backend | NestJS | API y orquestación |
| Arquitectura backend | Clean Architecture | Dominio independiente de frameworks |
| Persistencia | PostgreSQL + pgvector | Datos transaccionales y búsqueda semántica |
| ORM | Prisma | Repositorios concretos y migraciones |
| Validación | Zod o JSON Schema | Entradas, contratos de agentes y herramientas |
| Unit testing | Vitest | Pruebas rápidas y dobles de prueba |
| API testing | Supertest | Pruebas HTTP de integración |
| E2E | Playwright | Flujos completos del navegador |
| IA | Puerto `LanguageModelPort` | Proveedor intercambiable |
| Contenedores | Docker Compose + Dev Containers | Entorno reproducible |
| Observabilidad | OpenTelemetry + logs JSON | Trazas y métricas |

## 4. OpenAI: necesidad y uso

No se necesita una API key de OpenAI para construir el dominio, el frontend, el backend, los agentes, las skills ni las pruebas unitarias.

La aplicación definirá este puerto en la capa de aplicación:

```ts
export interface LanguageModelPort {
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T>;
}
```

Implementaciones previstas:

- `FakeLanguageModelAdapter`: respuestas deterministas para pruebas unitarias.
- `MockLanguageModelAdapter`: escenarios configurables para desarrollo y demostración.
- `OpenAiLanguageModelAdapter`: integración opcional para pruebas manuales o producción.

Reglas:

- `LLM_PROVIDER=mock` será el valor predeterminado.
- `OPENAI_API_KEY` será opcional y solo se leerá en el backend.
- La clave nunca se enviará a Angular, se incluirá en imágenes o se confirmará en Git.
- CI ejecutará pruebas con el fake/mock, sin consumo ni costo externo.
- Las pruebas del adaptador OpenAI serán contract tests excluidos del pipeline normal y requerirán habilitación explícita.
- El proveedor y el modelo se configurarán por entorno, no en el dominio.

## 5. Alcance funcional

### 5.1 Tipologías obligatorias

1. **Acceso e identidad:** bloqueos, reseteo de contraseña, MFA y cuentas deshabilitadas.
2. **Infraestructura y software local:** VPN, rendimiento, servicios internos y aplicaciones corporativas.
3. **Aprovisionamiento y permisos:** carpetas, repositorios, licencias y perfiles de usuario.

### 5.2 Capacidades obligatorias

- Clasificar categoría y subcategoría.
- Calcular prioridad a partir de impacto y urgencia.
- Extraer usuario afectado, servicio y criticidad de negocio.
- Detectar información faltante.
- Ejecutar diagnósticos automáticos y seguros.
- Ejecutar únicamente remediaciones permitidas, reversibles e idempotentes.
- Escalar casos severos, ambiguos o no soportados.
- Transferir únicamente contexto necesario.
- Generar mensajes profesionales sin jerga innecesaria.
- Auditar cada decisión, herramienta, transición y resultado.

## 6. Requerimientos funcionales

### RF-01. Crear ticket

- Recibir asunto y descripción en lenguaje natural.
- Asociar solicitante autenticado, canal y fecha UTC.
- Generar UUID interno y número visible `TCK-AAAA-NNNNNN`.
- Detectar y redactar posibles secretos antes de persistir o enviar texto a un modelo.

### RF-02. Clasificar y extraer entidades

- Devolver categoría, subcategoría, impacto, urgencia, confianza y entidades.
- Usar `OTRO` cuando no exista una categoría compatible.
- Escalar si la confianza es inferior a `0.75`.
- Conservar versión de prompt, proveedor, modelo y correcciones humanas.

### RF-03. Calcular prioridad y SLA

| Prioridad | Condición | Acuse | Resolución objetivo |
|---|---|---:|---:|
| P1 | Servicio crítico caído o impacto general | 15 min | 4 h |
| P2 | Varios usuarios o proceso importante degradado | 30 min | 8 h |
| P3 | Un usuario con impacto moderado | 4 h | 2 días hábiles |
| P4 | Solicitud planificada o impacto menor | 1 día hábil | 5 días hábiles |

La matriz debe ser configurable. El modelo sugiere; una política determinista del dominio decide.

### RF-04. Diagnosticar

- Seleccionar una skill únicamente si cumple sus criterios de activación.
- Validar entradas y salidas mediante esquema.
- Aplicar timeout, cancelación y reintentos limitados.
- Registrar evidencia sanitizada por paso.
- Distinguir éxito, fallo funcional, fallo de herramienta e inconcluso.

### RF-05. Remediar

- Permitir ejecución automática solo para acciones de riesgo bajo incluidas en una allowlist.
- Solicitar aprobación humana para riesgo medio.
- Prohibir acciones destructivas, privilegios elevados o comandos arbitrarios.
- Verificar el resultado antes de declarar resolución.
- Escalar si la acción o su verificación falla.

### RF-06. Escalar

Escalar cuando ocurra cualquiera de estas condiciones:

- Prioridad P1.
- Confianza menor que `0.75`.
- Categorías contradictorias.
- Información insuficiente tras solicitar aclaración.
- Herramienta no disponible.
- Máximo de intentos alcanzado.
- Acción fuera de permisos.
- Resultado no conforme al esquema.

### RF-07. Comunicar

- Informar estado, siguiente paso y expectativa según SLA.
- No asegurar resolución antes de verificarla.
- Evitar detalles técnicos innecesarios.
- Permitir respuestas en `es-CO` y preparar internacionalización.

### RF-08. Auditar

- Registrar actor, evento, timestamp UTC, `correlationId`, versión y metadatos sanitizados.
- Mantener auditoría append-only desde la aplicación.
- No almacenar cadena de razonamiento interna.

## 7. Custom Instructions: ciclo de vida

### 7.1 Estados

`NUEVO`, `CLASIFICADO`, `EN_DIAGNOSTICO`, `PENDIENTE_USUARIO`, `PENDIENTE_APROBACION`, `EN_REMEDIACION`, `ESCALADO`, `RESUELTO`, `CERRADO`, `REABIERTO`, `CANCELADO`.

### 7.2 Transiciones permitidas

| Desde | Hacia | Campos/condición obligatoria |
|---|---|---|
| NUEVO | CLASIFICADO | Categoría, impacto, urgencia, prioridad y confianza |
| NUEVO | CANCELADO | Motivo y actor |
| CLASIFICADO | EN_DIAGNOSTICO | Skill o responsable asignado |
| CLASIFICADO | ESCALADO | Motivo y cola destino |
| EN_DIAGNOSTICO | PENDIENTE_USUARIO | Pregunta concreta sin solicitar secretos |
| EN_DIAGNOSTICO | PENDIENTE_APROBACION | Acción, riesgo y reversión |
| EN_DIAGNOSTICO | EN_REMEDIACION | Causa y acción permitida |
| EN_DIAGNOSTICO | ESCALADO | Evidencia y razón |
| PENDIENTE_USUARIO | EN_DIAGNOSTICO | Respuesta recibida |
| PENDIENTE_APROBACION | EN_REMEDIACION | Aprobación vigente |
| PENDIENTE_APROBACION | ESCALADO | Rechazo o vencimiento |
| EN_REMEDIACION | RESUELTO | Acción y verificación exitosas |
| EN_REMEDIACION | ESCALADO | Acción o verificación fallida |
| ESCALADO | EN_DIAGNOSTICO | Instrucción humana documentada |
| ESCALADO | RESUELTO | Solución humana y evidencia |
| RESUELTO | CERRADO | Confirmación o regla de cierre |
| RESUELTO | REABIERTO | Problema persiste |
| REABIERTO | EN_DIAGNOSTICO | Nuevo intento correlacionado |

Toda transición no listada devuelve `409 Conflict` y registra el intento. Un ticket solo puede marcarse `RESUELTO` si tiene causa o explicación, acción documentada, verificación exitosa, ausencia de tareas pendientes y mensaje al usuario.

Las reglas se documentarán también en `.github/copilot-instructions.md`, pero la lógica ejecutable permanecerá en el dominio.

## 8. Custom Agents y handoffs

### 8.1 Agente de clasificación y triage

**Responsabilidad:** redactar secretos, clasificar, extraer entidades, detectar faltantes y proponer destino.

**Puede:** leer la versión sanitizada del ticket, consultar catálogo y SLA, validar su salida.  
**No puede:** cambiar usuarios, ejecutar infraestructura, acceder a secretos o cerrar tickets.

Salida mínima:

```json
{
  "category": "INFRASTRUCTURE_SOFTWARE",
  "subcategory": "VPN",
  "impact": "SINGLE_USER",
  "urgency": "MEDIUM",
  "suggestedPriority": "P3",
  "confidence": 0.92,
  "entities": { "service": "corporate-vpn" },
  "missingInformation": [],
  "nextAction": "HANDOFF_DIAGNOSTIC"
}
```

### 8.2 Agente de diagnóstico y remediación

**Responsabilidad:** seleccionar skills, ejecutar diagnósticos, proponer remediación y verificarla.

**Puede:** usar skills registradas, herramientas read-only y remediaciones allowlisted.  
**No puede:** elevar privilegios, ejecutar texto del usuario como comando, aprobar su propia acción o ignorar un esquema inválido.

### 8.3 Política determinista de handoff

```text
Triage -> Diagnóstico
  confianza >= 0.75 + categoría soportada + información mínima completa

Triage -> Humano
  P1 o confianza baja o categoría ambigua/no soportada

Diagnóstico -> Aprobación humana
  remediación de riesgo medio

Diagnóstico -> Humano
  herramienta fallida, intentos agotados, ambigüedad o acción prohibida

Diagnóstico -> Resuelto
  diagnóstico + remediación + verificación exitosos
```

- No existe handoff directo de Diagnóstico a Triage.
- Una reclasificación se solicita al orquestador como evento.
- Máximo inicial: cinco transiciones por ejecución.
- Contexto: IDs, categoría, prioridad, resumen sanitizado, evidencia, pasos realizados y motivo.
- Nunca se transfieren secretos, PII innecesaria ni razonamiento interno.

## 9. Agent Skill obligatoria

Se implementará `diagnose-vpn-connectivity`.

### 9.1 Activación

- Categoría `INFRASTRUCTURE_SOFTWARE`.
- Subcategoría `VPN` con confianza mínima `0.80`.
- Sistema operativo y error disponibles.
- Entrada sin secretos pendientes de redacción.

### 9.2 Pasos

1. Validar parámetros.
2. Consultar estado del servicio simulado.
3. Resolver DNS de un endpoint allowlisted.
4. Validar conectividad TCP al puerto configurado.
5. Interpretar con reglas deterministas.
6. Recomendar acción segura o escalar.
7. Guardar evidencia sanitizada.

### 9.3 Recurso auxiliar

`scripts/check-vpn-connectivity.ts` devolverá JSON con `dnsResolved`, `tcpReachable`, `latencyMs`, `timestamp` y `errorCode`.

- No aceptará comandos libres.
- Timeout de 10 segundos por prueba.
- Enmascarará IP privadas.
- Reintentará una vez solo ante fallo transitorio.
- Ante ausencia de respuesta devolverá `TOOL_UNAVAILABLE` y forzará escalamiento.
- Nunca inventará una medición.

```text
.github/skills/diagnose-vpn-connectivity/
├── SKILL.md
├── schemas/input.schema.json
├── schemas/output.schema.json
├── scripts/check-vpn-connectivity.ts
└── tests/check-vpn-connectivity.spec.ts
```

## 10. Prompt Files

```text
.github/prompts/
├── triage-ticket.prompt.md
├── diagnose-ticket.prompt.md
├── propose-remediation.prompt.md
└── summarize-escalation.prompt.md
```

Cada prompt debe:

- Declarar propósito, agente y herramientas permitidas.
- Recibir variables como `${ticketId}`, `${description}` y `${locale}`.
- Tratar el texto del usuario como dato no confiable.
- Exigir salida estructurada validable.
- Definir criterios de detención y escalamiento.
- Manejar datos faltantes y herramientas fallidas.
- Tener pruebas unitarias de renderizado, variables requeridas y esquema de salida.

## 11. Arquitectura frontend Angular

Arquitectura **feature-first por capas** con componentes standalone:

```text
apps/web/src/app/
├── core/                         # auth, configuración, HTTP, guards
├── shared/                       # UI reutilizable sin negocio
├── layout/
└── features/
    ├── tickets/
    │   ├── domain/
    │   ├── application/
    │   ├── infrastructure/
    │   └── presentation/
    ├── agent-runs/
    ├── approvals/
    └── administration/
```

Reglas:

- `presentation` depende de `application`, no de HTTP.
- `application` depende de puertos de `domain`.
- `infrastructure` implementa los puertos.
- `domain` no depende de Angular.
- Las features exponen API pública y no importan internals entre sí.
- Signals gestionan estado local; Signal Store/NgRx solo para estado compartido complejo.
- Rutas lazy, TypeScript strict y WCAG 2.2 AA.

Pantallas mínimas: crear ticket, listado, detalle/línea de tiempo, ejecución de agentes, aprobaciones, escalamiento, resolución y reapertura.

## 12. Backend NestJS con Clean Architecture

```text
apps/api/src/
├── domain/                       # entidades, value objects, eventos y puertos
├── application/                  # casos de uso, comandos, queries y puertos
├── infrastructure/               # Prisma, IA, auth, herramientas, telemetría
├── interfaces/                   # controladores HTTP, jobs y consumidores
└── main.ts
```

Dirección permitida:

```text
Interfaces/Infrastructure -> Application -> Domain
```

- Dominio no importa NestJS, Prisma, HTTP ni SDK de IA.
- Aplicación coordina casos de uso y puertos.
- Infraestructura contiene adaptadores.
- Controladores solo validan, autorizan, llaman al caso de uso y presentan.
- Objetos Prisma no salen de infraestructura.

Casos de uso mínimos: `CreateTicket`, `ClassifyTicket`, `StartDiagnostic`, `RecordDiagnosticStep`, `ProposeRemediation`, `ApproveRemediation`, `ExecuteRemediation`, `EscalateTicket`, `ResolveTicket`, `CloseTicket`, `ReopenTicket` y `GetTicketTimeline`.

## 13. API REST

Base `/api/v1`:

| Método | Ruta | Uso |
|---|---|---|
| POST | `/tickets` | Crear ticket |
| GET | `/tickets` | Listar y filtrar |
| GET | `/tickets/{id}` | Consultar detalle |
| GET | `/tickets/{id}/timeline` | Consultar historial |
| POST | `/tickets/{id}/classifications` | Clasificar |
| POST | `/tickets/{id}/diagnostics` | Iniciar diagnóstico |
| GET | `/agent-runs/{id}` | Consultar ejecución sanitizada |
| POST | `/tickets/{id}/remediations` | Proponer remediación |
| POST | `/remediations/{id}/approval` | Aprobar o rechazar |
| POST | `/tickets/{id}/escalations` | Escalar |
| POST | `/tickets/{id}/resolution` | Resolver |
| POST | `/tickets/{id}/closure` | Cerrar |
| POST | `/tickets/{id}/reopen` | Reabrir |

JSON `camelCase`, fechas ISO 8601 UTC, Problem Details, paginación por cursor, OpenAPI, `X-Correlation-Id`, `Idempotency-Key` y control optimista de concurrencia.

## 14. PostgreSQL + pgvector

Los agentes no ejecutan SQL ni poseen bases separadas; acceden mediante casos de uso.

Tablas mínimas:

- `tickets`
- `ticket_classifications`
- `ticket_entities`
- `agent_runs`
- `agent_run_steps`
- `handoffs`
- `remediations`
- `approvals`
- `audit_events`
- `sla_policies`
- `knowledge_documents`
- `knowledge_chunks` con vector

Reglas: UUID, timestamps UTC, auditoría append-only, cifrado de campos sensibles, migraciones versionadas, índices por estado/prioridad/SLA y retención configurable.

## 15. Seguridad

- Roles: `END_USER`, `SUPPORT_AGENT`, `APPROVER`, `ADMIN`, `AUDITOR`.
- Autorización en backend por rol, propiedad y estado.
- Secretos solo en variables de entorno o gestor de secretos.
- Cookies `HttpOnly`, `Secure`, `SameSite` para sesión; nunca tokens persistentes en `localStorage`.
- Redacción antes de logs, persistencia y prompts.
- Validación de salida de IA con esquema cerrado.
- Protección contra prompt injection: separar instrucciones, datos recuperados y texto del usuario.
- Allowlist de herramientas, endpoints y acciones.
- Dependencias e imágenes escaneadas en CI.

## 16. Estrategia obligatoria de pruebas primero

### 16.1 Ciclo TDD por cambio

1. **Red:** escribir una prueba unitaria que describa el comportamiento y verificar que falle por la razón esperada.
2. **Green:** implementar el mínimo código para que pase.
3. **Refactor:** mejorar diseño manteniendo toda la suite verde.
4. Ejecutar lint, tipos y unit tests antes de integrar.
5. Añadir integración/E2E después de asegurar las unidades, sin sustituirlas.

No se acepta una funcionalidad cuya prueba se escriba únicamente después de la implementación.

### 16.2 Qué debe probarse unitariamente

| Componente | Pruebas mínimas |
|---|---|
| Máquina de estados | Todas las transiciones válidas e inválidas |
| Prioridad/SLA | Límites, combinaciones de impacto/urgencia y configuración |
| Redactor | Secretos, tokens, PII, falsos positivos y texto ya sanitizado |
| Casos de uso | Camino feliz, permisos, idempotencia, errores y eventos |
| Orquestador | Cada handoff, límite de pasos, rechazo de ciclos y timeout |
| Agentes | Salida válida/inválida, confianza, faltantes y fallo del proveedor |
| Skill VPN | Activación, cada resultado, timeout, reintento y sanitización |
| Prompts | Variables, herramientas permitidas y esquema esperado |
| Mappers | Dominio-DTO, Prisma-dominio y valores nulos |
| Angular facades/state | Carga, éxito, error, reintento y concurrencia |
| Guards/interceptors | Roles, sesión, correlación y manejo de errores |

### 16.3 Dobles de prueba

- Repositorios en memoria.
- Reloj y generador de UUID falsos.
- `FakeLanguageModelAdapter` determinista.
- Herramientas fake sin red ni comandos reales.
- Publicador de eventos espía.
- Proveedor de identidad simulado.

Las pruebas deben ser repetibles, independientes, rápidas y no depender del orden.

### 16.4 Organización

```text
src/domain/tickets/ticket.ts
src/domain/tickets/ticket.spec.ts
src/application/tickets/create-ticket.use-case.ts
src/application/tickets/create-ticket.use-case.spec.ts
```

Se prioriza colocalizar cada prueba unitaria con su unidad. Los fixtures reutilizables viven en `test/builders`, evitando objetos globales mutables.

### 16.5 Puertas de calidad

- 100% de ramas en máquina de estados, permisos, seguridad, handoffs y redacción.
- Mínimo 85% de líneas y ramas en dominio y aplicación.
- Mínimo 80% global, sin usar cobertura como sustituto de buenos casos.
- Cero pruebas deshabilitadas sin ticket y justificación.
- Mutación recomendada para políticas críticas.
- CI falla ante lint, tipos, unit tests, cobertura, contrato o secretos.

## 17. Estructura del repositorio

```text
ecosistema-agentes-helpdesk/
├── .devcontainer/
│   ├── devcontainer.json
│   └── Dockerfile
├── .github/
│   ├── agents/
│   ├── prompts/
│   ├── skills/
│   ├── workflows/ci.yml
│   └── copilot-instructions.md
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── contracts/
│   └── test-support/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
├── compose.yaml
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── REQUERIMIENTOS_TECNICOS.md
```

## 18. Docker y Reopen in Container

`compose.yaml` tendrá `workspace` y `postgres`:

```yaml
name: helpdesk-agents
services:
  workspace:
    build:
      context: .
      dockerfile: .devcontainer/Dockerfile
    volumes:
      - .:/workspace:cached
      - pnpm-store:/pnpm/store
    command: sleep infinity
    environment:
      DATABASE_URL: postgresql://helpdesk:helpdesk_dev@postgres:5432/helpdesk?schema=public
      LLM_PROVIDER: mock
    depends_on:
      postgres:
        condition: service_healthy
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: helpdesk
      POSTGRES_USER: helpdesk
      POSTGRES_PASSWORD: helpdesk_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U helpdesk -d helpdesk"]
      interval: 5s
      timeout: 5s
      retries: 10
volumes:
  postgres-data:
  pnpm-store:
```

`.devcontainer/Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm
RUN corepack enable \
    && corepack prepare pnpm@12.6.0 --activate
WORKDIR /workspace
```

`.devcontainer/devcontainer.json`:

```json
{
  "name": "Help Desk Agents",
  "dockerComposeFile": "../compose.yaml",
  "service": "workspace",
  "workspaceFolder": "/workspace",
  "shutdownAction": "stopCompose",
  "remoteUser": "root",
  "forwardPorts": [4200, 3000, 5432],
  "postCreateCommand": "bash .devcontainer/post-create.sh",
  "postStartCommand": "bash .devcontainer/post-start.sh",
  "customizations": {
    "vscode": {
      "extensions": [
        "angular.ng-template",
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-azuretools.vscode-docker"
      ]
    }
  }
}
```

`.env.example`:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://helpdesk:helpdesk_dev@postgres:5432/helpdesk?schema=public
LLM_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=
```

## 19. Ejecución automática con Reopen in Container

El flujo obligatorio debe requerir únicamente estas acciones:

1. Tener Docker Desktop activo, Visual Studio Code y la extensión Dev Containers.
2. Abrir la carpeta `ecosistema-agentes-helpdesk`.
3. Ejecutar **Dev Containers: Reopen in Container**.
4. Esperar a que VS Code abra el contenedor y el navegador muestre Angular.

No se requiere copiar `.env`, instalar Node.js/pnpm, ejecutar migraciones, iniciar PostgreSQL ni lanzar comandos manuales.

Automatización configurada:

- Docker Compose construye `workspace` y levanta PostgreSQL + pgvector.
- El healthcheck bloquea el workspace hasta que PostgreSQL esté disponible.
- `postCreateCommand` instala el lockfile y ejecuta todas las pruebas unitarias.
- `postStartCommand` inicia Angular y NestJS en segundo plano.
- VS Code reenvía los puertos y abre `http://localhost:4200`.
- El backend queda disponible en `http://localhost:3000/api/v1/health`.
- Los logs combinados quedan en `/tmp/helpdesk-dev.log`.

Si las pruebas unitarias fallan, la preparación se detiene y muestra el error; no se inicia una aplicación en estado inválido.

Comandos:

```bash
pnpm test:unit
pnpm test:unit --coverage
pnpm test:integration
pnpm test:e2e
pnpm lint
pnpm typecheck
docker compose ps
docker compose logs -f workspace postgres
docker compose down
```

`docker compose down --volumes` elimina la base local y solo se ejecutará intencionalmente.

## 20. Escenarios de aceptación

1. Cuenta bloqueada clasificada y enviada a diagnóstico.
2. VPN diagnosticada mediante la skill y verificada.
3. Solicitud de permisos enviada a aprobación humana.
4. Ticket P1 escalado inmediatamente.
5. Baja confianza escalada sin herramientas.
6. Timeout del script, reintento único y escalamiento.
7. Secreto en descripción detectado y redactado.
8. Handoff cíclico rechazado.
9. Remediación fallida no puede resolver el ticket.
10. Reapertura conserva historial.
11. Toda la suite unitaria pasa sin red, PostgreSQL ni API key.
12. La aplicación funciona en modo mock después de Reopen in Container.

## 21. Trazabilidad con el PDF

| Requisito del PDF | Evidencia |
|---|---|
| Node.js como tecnología principal | Monorepo TypeScript sobre Node.js y NestJS |
| Custom Instructions | Archivo con estados, transiciones, campos y resolución |
| Agent Skill | Skill VPN con procedimiento y criterios de activación |
| Recurso auxiliar | Script TypeScript funcional y probado |
| Manejo de fallos | Timeout, reintento, error tipado y escalamiento |
| Dos agentes especializados | Triage y diagnóstico/remediación |
| Herramientas y delegación | Allowlist y permisos explícitos |
| Handoffs deterministas | Política acotada, sin ciclos y con contexto mínimo |
| Prompt Files | Cuatro plantillas parametrizables y probadas |
| Seguridad y privacidad | Redacción, cifrado, autorización y secretos externos |
| Escalamiento y trazabilidad | Auditoría append-only y cola humana |
| Comunicación | Mensajes claros, estado, siguiente paso y SLA |

## 22. Orden de implementación TDD

1. Configurar monorepo, Vitest y CI.
2. Escribir primero pruebas de máquina de estados, prioridad, SLA y redacción.
3. Implementar dominio hasta dejarlas verdes.
4. Escribir pruebas de casos de uso con repositorios y proveedor IA falsos.
5. Implementar capa de aplicación.
6. Escribir pruebas del orquestador, agentes, handoffs y skill.
7. Implementar orquestación y scripts.
8. Escribir pruebas de facades, estado y componentes Angular.
9. Implementar la interfaz.
10. Añadir adaptadores Prisma y HTTP con pruebas de integración.
11. Añadir E2E sobre modo mock.
12. Incorporar el adaptador OpenAI solo como integración opcional.

## 23. Observabilidad y trazabilidad implementadas

- `X-Correlation-Id` se acepta o genera en cada solicitud, se devuelve al cliente y se propaga a la auditoría append-only.
- Angular muestra el último ID de seguimiento recibido para facilitar soporte y diagnóstico.
- Los logs HTTP son JSON e incluyen método, ruta, estado, duración, usuario e identificador de correlación.
- Antes de registrar datos se redactan secretos tanto por nombre de campo como por patrones dentro del texto.
- `/api/v1/health` comprueba que el proceso está vivo.
- `/api/v1/ready` comprueba que PostgreSQL responde y devuelve `503` cuando no está disponible.
- `/api/v1/metrics` expone contadores compatibles con Prometheus para solicitudes, errores 5xx y duración acumulada.
- Swagger documenta el encabezado opcional mediante el esquema `correlation-id`.
- Las pruebas unitarias cubren sanitización, métricas y estado del frontend; las E2E cubren propagación, readiness, métricas y persistencia en auditoría.

## 24. Paginación, filtros y contrato de errores implementados

- `GET /api/v1/tickets` implementa paginación estable por cursor usando `createdAt` e `id`.
- Admite `limit`, `cursor`, `status`, `priority` y búsqueda `q` por asunto o número.
- Los filtros y la propiedad del usuario se aplican en PostgreSQL antes de limitar resultados.
- Angular permite filtrar y cargar páginas adicionales sin reemplazar los resultados existentes.
- Los errores usan `application/problem+json` y el contrato Problem Details de RFC 9457.
- El detalle de error se redacta antes de salir y los errores inesperados no exponen información interna.
- El contrato `ProblemDetails` y las respuestas de error están disponibles en OpenAPI/Swagger.

## 25. Autenticación JWT/OIDC implementada

- `AUTH_MODE=mock` mantiene la experiencia automática de Reopen in Container y las pruebas deterministas.
- `AUTH_MODE=oidc` exige Bearer JWT y deshabilita la confianza en cabeceras de identidad mock.
- El adaptador OIDC valida firma contra un JWKS remoto, `iss`, `aud`, expiración y allowlist de algoritmos.
- `sub` se usa como identidad canónica y el claim de roles es configurable, incluso mediante una ruta anidada.
- `OIDC_ROLE_MAP` traduce grupos o roles externos a `END_USER`, `SUPPORT_AGENT`, `APPROVER`, `ADMIN` y `AUDITOR`.
- Si existen varios roles válidos se aplica una precedencia determinista; ningún claim no reconocido concede acceso.
- Swagger documenta `oidc-bearer` como alternativa a las dos cabeceras del modo mock.
- Las pruebas verifican criptografía real con claves efímeras, claims, mapeo, precedencia, rechazo de audience incorrecta, suplantación por cabeceras y mensajes seguros.

## 26. Definición de terminado

- Se cumplen todos los requisitos del PDF nuevo.
- Node.js es el runtime principal.
- Angular respeta feature-first por capas.
- NestJS respeta Clean Architecture.
- PostgreSQL + pgvector se levanta con Docker.
- El proyecto abre mediante Reopen in Container.
- Todas las funcionalidades se desarrollaron con ciclo TDD demostrable.
- Las pruebas unitarias no necesitan servicios externos.
- Los agentes, skills, prompts y handoffs tienen pruebas automatizadas.
- La solución funciona sin API key usando `LLM_PROVIDER=mock`.
- No hay secretos ni PII en texto plano.
- La auditoría permite reconstruir cada decisión sin guardar razonamiento interno.
