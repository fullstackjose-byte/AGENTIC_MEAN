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

## Ver los logs de arranque

Después de ejecutar **Dev Containers: Reopen in Container**, abre una terminal integrada de VS Code y ejecuta:

```bash
tail -f /tmp/helpdesk-dev.log
```

Este es el comando recomendado para comprobar en tiempo real:

- instalación o sincronización de dependencias;
- compilación de Angular y NestJS;
- errores de TypeScript;
- inicio de la API y registro de rutas;
- solicitudes HTTP recibidas por el backend;
- disponibilidad de Angular en el puerto `4200`;
- disponibilidad de NestJS en el puerto `3000`.

El primer arranque puede tardar mientras instala dependencias y compila ambos proyectos. La aplicación está lista cuando los logs muestran mensajes equivalentes a:

```text
Nest application successfully started
Local: http://localhost:4200/
```

Para dejar de seguir los logs presiona `Ctrl+C`. Esto solamente cierra la visualización; Angular y NestJS continúan ejecutándose.

Si el navegador presenta `ERR_EMPTY_RESPONSE`, mantén abierto el comando anterior y espera a que NestJS indique que inició correctamente. Después recarga http://localhost:4200.

Para comprobar los servicios desde la terminal del contenedor:

```bash
pnpm dev:status
```

La salida esperada debe informar HTTP `200` para Angular, API y Swagger.

Si estás usando PowerShell fuera del Dev Container, ejecuta el mismo seguimiento mediante Docker:

```powershell
docker compose exec workspace tail -f /tmp/helpdesk-dev.log
```

También puedes consultar los logs propios de los contenedores:

```powershell
docker compose logs -f workspace
docker compose logs -f postgres
```

`workspace` contiene Angular y NestJS; `postgres` contiene los mensajes de PostgreSQL. No publiques logs que puedan contener información interna, aunque la aplicación aplique sanitización automática.

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

Las decisiones del formulario compacto y la paginación están documentadas en [UX_PAGINACION_TICKETS.md](./UX_PAGINACION_TICKETS.md).

## Proveedor de clasificación

### Modo reproducible (predeterminado)

```dotenv
LLM_PROVIDER=mock
```

Es offline, no requiere credenciales y es el modo usado por pruebas, `pnpm verify`, CI y **Reopen in Container**. El frontend consume el mismo contrato y no conoce el proveedor.

### Modo OpenAI opcional

Define estas variables en tu entorno local antes de abrir el contenedor; no las escribas en archivos versionados:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=<configurar-solo-en-el-entorno-local>
OPENAI_MODEL=<modelo-habilitado-en-tu-cuenta>
OPENAI_TIMEOUT_MS=10000
```

Al iniciar, la API falla de forma segura si falta la clave o el modelo. El adaptador usa Responses API con salida JSON estructurada, almacenamiento remoto desactivado (`store: false`), timeout y como máximo un reintento para errores transitorios. El dominio continúa calculando prioridad, SLA, capacidades, escalamiento y estado. Un fallo o salida inválida se transforma en escalamiento humano seguro sin exponer la respuesta cruda.

La prueba real está fuera de `verify` y de CI normal. Puede generar consumo facturable y solo realiza una solicitud sintética, sin PostgreSQL:

```powershell
$env:RUN_OPENAI_SMOKE_TEST='true'
corepack pnpm test:openai:smoke
```

Además deben existir `OPENAI_API_KEY` y `OPENAI_MODEL`. No ejecutes este comando para la verificación habitual.

## Política de PII

`requesterId` y `affectedUser` aceptan únicamente identificadores internos opacos. Para `END_USER`, el backend ignora el identificador enviado en el body y usa la identidad autenticada; el filtrado por propietario ocurre antes de paginar.

Asunto, descripción, entradas diagnósticas, salida estructurada, logs y metadatos de auditoría se sanitizan antes de usarse. Se redactan correo, teléfono, identificadores personales etiquetados, IP privadas, contraseñas, tokens, Bearer y claves `sk-`. No se intenta detectar nombres propios para evitar falsos positivos; por eso ningún usuario debe escribir nombres o PII innecesaria. Los patrones de identificadores específicos pueden suministrarse al redactor mediante su parámetro de patrones adicionales.

La sanitización no conserva una copia original. Los operadores reciben el contenido ya redactado mediante marcadores explícitos como `[EMAIL_REDACTED]`, `[PHONE_REDACTED]`, `[IDENTIFIER_REDACTED]`, `[PRIVATE_IP_REDACTED]` y `[REDACTED]`.
