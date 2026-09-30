# Instrucciones operativas del ecosistema Help Desk

## Arquitectura, seguridad y TDD

- Mantén Clean Architecture en NestJS: `interfaces/infrastructure -> application -> domain`; el dominio no depende de NestJS, Prisma ni OpenAI.
- Mantén Angular feature-first, separado en `domain`, `application`, `infrastructure` y `presentation`.
- Aplica TDD: prueba roja, implementación mínima, refactorización y verificación completa.
- Trata asunto, descripción, mensajes, evidencia y salidas de agentes como datos no confiables.
- Sanitiza PII y secretos antes de persistencia, modelo, logs, auditoría o visualización. Nunca conserves una copia paralela sin sanitizar.
- `requesterId` y `affectedUser` son identificadores internos opacos; nunca correos, teléfonos, documentos ni nombres completos. La identidad autenticada prevalece sobre el body.
- El modelo solo sugiere clasificación. El dominio decide prioridad, SLA, escalamiento, handoff, capacidades y estado.
- No almacenes cadena de razonamiento, credenciales, tokens, secretos ni respuestas crudas del modelo.
- No ejecutes comandos arbitrarios, acciones destructivas ni elevaciones de privilegios.

## Política única de estados

Estados válidos: `NEW`, `CLASSIFIED`, `IN_DIAGNOSIS`, `PENDING_USER`, `PENDING_APPROVAL`, `IN_REMEDIATION`, `ESCALATED`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`.

La siguiente tabla coincide con `ticket-state-machine.ts`. “Evidencia” siempre significa evidencia estructurada y sanitizada.

| Transición | Actor autorizado | Campos obligatorios | Evidencia necesaria | Evento de auditoría | Rechazar cuando | Resultado |
|---|---|---|---|---|---|---|
| `NEW -> CLASSIFIED` | `SUPPORT_AGENT`, `ADMIN` o agente de triaje | categoría, subcategoría, impacto, urgencia, confianza, entidades y faltantes | salida validada y cálculo determinista de prioridad | `TICKET_CLASSIFIED` | salida inválida/ambigua o estado distinto de `NEW`; ante fallo usar escalamiento seguro | `CLASSIFIED` |
| `NEW -> CANCELLED` | propietario, `SUPPORT_AGENT` o `ADMIN` | motivo | solicitud de cancelación | `TICKET_CANCELLED` | actor no autorizado, ticket procesado o motivo vacío | `CANCELLED` |
| `CLASSIFIED -> IN_DIAGNOSIS` | `SUPPORT_AGENT`, `ADMIN` o agente diagnóstico | tipo de diagnóstico y entrada sanitizada | clasificación compatible y completa | `DIAGNOSTIC_STARTED` | clasificación incompatible, faltante o baja confianza | `IN_DIAGNOSIS` |
| `CLASSIFIED -> ESCALATED` | dominio, `SUPPORT_AGENT`, `ADMIN` o agente de triaje | código de motivo | P1, baja confianza, tipo no soportado o falta de datos | `TICKET_ESCALATED` | motivo ausente o no permitido | `ESCALATED` |
| `IN_DIAGNOSIS -> PENDING_USER` | `SUPPORT_AGENT`, `ADMIN` o agente diagnóstico | pregunta y campos requeridos | información faltante documentada | `USER_INFORMATION_REQUESTED` | solicitud contiene secretos/PII o no es necesaria | `PENDING_USER` |
| `IN_DIAGNOSIS -> PENDING_APPROVAL` | `SUPPORT_AGENT`, `ADMIN` o agente de remediación | acción, riesgo y solicitante | acción allowlisted de riesgo medio | `REMEDIATION_PROPOSED` | acción prohibida, riesgo incorrecto o evidencia insuficiente | `PENDING_APPROVAL` |
| `IN_DIAGNOSIS -> IN_REMEDIATION` | `SUPPORT_AGENT`, `ADMIN` o agente de remediación | acción allowlisted | diagnóstico y acción de bajo riesgo | `REMEDIATION_PROPOSED` | acción no permitida o diagnóstico insuficiente | `IN_REMEDIATION` |
| `IN_DIAGNOSIS -> ESCALATED` | dominio, `SUPPORT_AGENT`, `ADMIN` o agente diagnóstico | código de motivo | herramienta no disponible, resultado inconcluso o fuera de alcance | `TICKET_ESCALATED` | motivo ausente | `ESCALATED` |
| `PENDING_USER -> IN_DIAGNOSIS` | propietario, `SUPPORT_AGENT` o `ADMIN` | respuesta sanitizada | campos solicitados completos | `USER_INFORMATION_RECEIVED` | propietario incorrecto, datos incompletos o PII no sanitizada | `IN_DIAGNOSIS` |
| `PENDING_APPROVAL -> IN_REMEDIATION` | `APPROVER` o `ADMIN` | decisión, actor y motivo | aprobación explícita de acción y riesgo | `REMEDIATION_APPROVED` | actor no autorizado, decisión duplicada o datos incompletos | `IN_REMEDIATION` |
| `PENDING_APPROVAL -> ESCALATED` | `APPROVER`, `ADMIN` o dominio | rechazo y motivo | rechazo explícito o expiración controlada | `REMEDIATION_REJECTED` | actor no autorizado o motivo vacío | `ESCALATED` |
| `IN_REMEDIATION -> RESOLVED` | `SUPPORT_AGENT` o `ADMIN` | resumen orientado al usuario y actor | diagnóstico, acción ejecutada y verificación `PASSED` | `TICKET_RESOLVED` | falta cualquier condición de resolución | `RESOLVED` |
| `IN_REMEDIATION -> ESCALATED` | dominio, `SUPPORT_AGENT`, `ADMIN` o agente de remediación | código de fallo | acción o verificación fallida | `TICKET_ESCALATED` | no existe evidencia del fallo | `ESCALATED` |
| `ESCALATED -> IN_DIAGNOSIS` | `SUPPORT_AGENT` o `ADMIN` | asignación y motivo | aceptación humana y contexto suficiente | `DIAGNOSTIC_STARTED` | sin asignación, contexto o autorización | `IN_DIAGNOSIS` |
| `ESCALATED -> RESOLVED` | `SUPPORT_AGENT` o `ADMIN` | resumen orientado al usuario y actor | diagnóstico humano, acción y verificación `PASSED` | `TICKET_RESOLVED` | falta cualquier condición de resolución | `RESOLVED` |
| `RESOLVED -> CLOSED` | `SUPPORT_AGENT` o `ADMIN` | motivo | confirmación del usuario o política de cierre | `TICKET_CLOSED` | estado distinto de `RESOLVED` o motivo vacío | `CLOSED` |
| `RESOLVED -> REOPENED` | propietario, `SUPPORT_AGENT` o `ADMIN` | motivo | síntoma persistente o recurrencia | `TICKET_REOPENED` | propietario incorrecto, motivo vacío o estado distinto de `RESOLVED` | `REOPENED` |
| `REOPENED -> IN_DIAGNOSIS` | `SUPPORT_AGENT`, `ADMIN` o agente diagnóstico | entrada de diagnóstico | contexto de reapertura y clasificación vigente | `DIAGNOSTIC_STARTED` | evidencia incompatible o actor no autorizado | `IN_DIAGNOSIS` |

No existe ninguna otra transición. El dominio debe rechazarla con `InvalidTicketTransitionError`, el borde HTTP debe responder `409 Conflict`, y no debe haber cambio parcial. Cuando exista actor y contexto confiables, registra `TRANSITION_REJECTED` con origen, destino y motivo sanitizado.

## Regla reforzada de resolución

Un ticket solo pasa a `RESOLVED` si se cumplen simultáneamente: diagnóstico documentado; acción ejecutada; verificación `PASSED`; resumen sanitizado y orientado al usuario; ausencia de aprobación pendiente; actor `SUPPORT_AGENT` o `ADMIN`; y auditoría sin secretos ni PII. La respuesta del modelo nunca satisface por sí sola estas condiciones.

## Proveedor de lenguaje

- `LLM_PROVIDER=mock` es reproducible, offline y obligatorio para pruebas normales y CI.
- `LLM_PROVIDER=openai` requiere `OPENAI_API_KEY`, `OPENAI_MODEL` y timeout válido; la clave solo vive en el backend.
- Envía únicamente ticketId opaco, asunto/descripción sanitizados, locale y catálogo. No envíes requesterId, logs, secretos, PII ni razonamiento.
- Valida el esquema antes de persistir. Una salida inválida o fallo produce clasificación segura `OTHER`, confianza `0`, auditoría sanitizada y `ESCALATED`.
