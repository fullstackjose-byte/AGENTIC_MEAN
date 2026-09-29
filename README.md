# Ecosistema de Agentes Help Desk

## Inicio rápido

1. Abre esta carpeta en Visual Studio Code.
2. Ejecuta **Dev Containers: Reopen in Container**.
3. Espera a que termine la preparación automática.

No necesitas instalar Node.js, pnpm ni PostgreSQL. El contenedor instala dependencias, genera Prisma, aplica migraciones, ejecuta pruebas unitarias y arranca Angular y NestJS.

- Aplicación: http://localhost:4200
- API: http://localhost:3000/api/v1/health
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json
- Logs en el contenedor: `tail -f /tmp/helpdesk-dev.log`

## Observabilidad local

La API acepta opcionalmente `X-Correlation-Id`; si no se envía, genera un UUID. El valor siempre vuelve en la respuesta, se incorpora a la auditoría del ticket y aparece como `ID de seguimiento` en Angular. Los logs HTTP son JSON, incluyen duración y resultado, y redactan contraseñas, tokens, cookies y claves.

- Liveness: http://localhost:3000/api/v1/health
- Readiness de PostgreSQL: http://localhost:3000/api/v1/ready
- Métricas Prometheus: http://localhost:3000/api/v1/metrics

En Swagger, el esquema `correlation-id` permite usar un mismo identificador durante una prueba completa. Este identificador no debe contener secretos ni datos personales.

## Paginación, filtros y errores

`GET /api/v1/tickets` devuelve `{ items, pageInfo }` y admite `limit` (1–100), `cursor`, `status`, `priority` y `q`. El cursor es opaco: para avanzar se debe reutilizar exactamente `pageInfo.nextCursor`. Los usuarios finales reciben únicamente sus propios tickets antes de aplicar la paginación.

Los errores HTTP usan `application/problem+json` conforme a Problem Details (RFC 9457). Cada respuesta incluye `type`, `title`, `status`, `detail`, `instance`, `correlationId` y `timestamp`; Swagger documenta este contrato en todos los endpoints.

## Funcionalidad disponible

- Crear y listar tickets desde Angular.
- Redactar tokens y contraseñas antes de persistir.
- Clasificar un ticket con el agente local desde la interfaz.
- Consultar capacidades calculadas por el backend para mostrar solamente acciones compatibles.
- Orientar identidad y aprovisionamiento a una solicitud segura de información o a escalamiento humano.
- Ejecutar un diagnóstico VPN mock con evidencia DNS/TCP.
- Proponer remediaciones allowlisted de riesgo bajo o medio.
- Aprobar o rechazar acciones de riesgo medio desde Angular o Swagger.
- Resolver tickets únicamente después de una verificación exitosa.
- Consultar una línea de tiempo append-only por ticket.
- Cerrar tickets resueltos o reabrirlos para regresar a diagnóstico.
- Calcular prioridad mediante una política determinista.
- Escalar automáticamente P1, baja confianza y solicitudes no soportadas.
- Persistir tickets y clasificaciones auditables en PostgreSQL mediante Prisma.
- Ejecutar sin API key con `LLM_PROVIDER=mock`.
- Probar autorización local con `AUTH_MODE=mock` y roles por cabecera.

## Autenticación local y OIDC

Swagger muestra el botón **Authorize**. Completa ambas credenciales:

- `user-id`: por ejemplo `support-demo`.
- `user-role`: `END_USER`, `SUPPORT_AGENT`, `APPROVER`, `ADMIN` o `AUDITOR`.

Para clasificación, diagnóstico y remediación usa `SUPPORT_AGENT`. Para aprobar utiliza `APPROVER`. Este modo sigue activo automáticamente al usar Reopen in Container.

Para un proveedor real configura `AUTH_MODE=oidc` y las variables siguientes:

```dotenv
AUTH_MODE=oidc
OIDC_ISSUER=https://identity.example.com/
OIDC_AUDIENCE=helpdesk-api
OIDC_JWKS_URI=https://identity.example.com/.well-known/jwks.json
OIDC_ROLES_CLAIM=roles
OIDC_ROLE_MAP={"helpdesk-user":"END_USER","helpdesk-support":"SUPPORT_AGENT","helpdesk-approver":"APPROVER","helpdesk-admin":"ADMIN","helpdesk-auditor":"AUDITOR"}
OIDC_ALLOWED_ALGORITHMS=RS256
```

En este modo Swagger utiliza `oidc-bearer`. La API valida firma con JWKS, expiración, issuer, audience, algoritmo permitido, `sub` y rol reconocido. Las cabeceras `X-User-Id` y `X-User-Role` se ignoran, por lo que no pueden suplantar el token. `OIDC_ROLES_CLAIM` acepta rutas anidadas como `realm_access.roles`.

El frontend no persiste access tokens. Para un login interactivo debe conectarse el SDK oficial del proveedor elegido y preferiblemente una sesión BFF con cookie `HttpOnly`; Swagger permite comprobar inmediatamente un access token emitido para esta API.

Rutas implementadas:

- `POST /api/v1/tickets`
- `GET /api/v1/tickets`
- `GET /api/v1/tickets/:id`
- `POST /api/v1/tickets/:id/classifications`
- `GET /api/v1/tickets/:id/capabilities`
- `POST /api/v1/tickets/:id/diagnostics`
- `POST /api/v1/tickets/:id/remediations`
- `GET /api/v1/remediations/pending`
- `POST /api/v1/remediations/:id/approval`
- `POST /api/v1/tickets/:id/resolution`
- `GET /api/v1/tickets/:id/timeline`
- `POST /api/v1/tickets/:id/closure`
- `POST /api/v1/tickets/:id/reopen`

Consulta [REQUERIMIENTOS_TECNICOS.md](./REQUERIMIENTOS_TECNICOS.md) para la arquitectura, los requisitos y el alcance completo.
