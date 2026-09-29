Actúa como ingeniero senior full-stack especializado en Node.js, NestJS, Angular, TypeScript, sistemas multiagente y seguridad.

Trabaja directamente sobre este proyecto:

C:\Users\JoseOrellana\OneDrive - K Lab Inc\Escritorio\agentes2026\AGENTIC_MEAN

El enunciado original está en:

C:\Users\JoseOrellana\.codex\attachments\8dc0f95f-fb6d-4173-8958-808935402e8b\Prueba_Tecnica_Ecosistema_Agentes_HelpDesk (1) (2).pdf

OBJETIVO

Haz que el proyecto cumpla completamente la prueba técnica del PDF y corrige los defectos encontrados durante la revisión funcional.

No te limites a explicar o proponer cambios: inspecciona el repositorio, implementa las mejoras, añade pruebas y verifica el resultado completo.

CONTEXTO ACTUAL

La solución ya tiene:

- Monorepo pnpm.
- Angular y NestJS.
- PostgreSQL y Prisma.
- Clasificación mock determinista.
- Diagnóstico VPN.
- Remediaciones de riesgo bajo y medio.
- Aprobación humana.
- Auditoría append-only.
- RBAC mock y OIDC.
- Custom Instructions.
- Dos Custom Agents.
- Una Agent Skill de VPN.
- Tres Prompt Files.
- 80 pruebas unitarias y 6 pruebas E2E actualmente aprobadas.
- IA mock sin API key.

Conserva todo lo que funciona y evita reescrituras innecesarias.

DEFECTOS Y REQUISITOS A CORREGIR

1. SOPORTE CORRECTO DE LAS TRES TIPOLOGÍAS

Las tipologías obligatorias son:

- Acceso e identidad.
- Infraestructura y software local.
- Aprovisionamiento y permisos.

Actualmente, un ticket de identidad se clasifica correctamente, pero el frontend muestra “Diagnosticar VPN”. Cuando se pulsa, el backend rechaza la operación.

Corrige este comportamiento.

Requisitos:

- El frontend solo debe mostrar “Diagnosticar VPN” cuando la clasificación más reciente sea:
  - categoría `INFRASTRUCTURE_SOFTWARE`;
  - subcategoría `VPN`;
  - confianza mínima `0.80`;
  - información requerida completa.
- Para identidad y aprovisionamiento, muestra el siguiente paso adecuado:
  - diagnóstico específico si existe;
  - solicitud de información segura;
  - o escalamiento humano claramente explicado.
- Nunca presentes una acción incompatible con la clasificación.
- El backend debe exponer al frontend la información o las capacidades necesarias para decidir qué acciones están permitidas.
- No dupliques las reglas de autorización únicamente en Angular: el backend seguirá siendo la autoridad.
- Añade pruebas para VPN, identidad, aprovisionamiento, categoría desconocida, baja confianza y P1.

2. EXTRACCIÓN COMPLETA DE ENTIDADES

La clasificación debe representar explícitamente:

- usuario afectado;
- servicio impactado;
- criticidad de negocio;
- información faltante.

Actualiza contratos, tipos, persistencia, adaptadores, DTO/OpenAPI y pruebas.

No inventes información. Si una entidad no está presente, debe quedar ausente o registrarse dentro de `missingInformation`.

Mantén una política determinista para la prioridad final.

3. COMUNICACIÓN ORIENTADA AL USUARIO

No muestres directamente como mensaje principal códigos técnicos como:

- `CONNECTIVITY_OK`;
- `VERIFY_CLIENT_CONFIGURATION`;
- `RESET_VPN_CONFIGURATION`;
- `IN_DIAGNOSIS`;
- `PENDING_APPROVAL`.

Implementa una capa de presentación que traduzca estados, diagnósticos, recomendaciones y acciones a mensajes claros en español de Colombia.

Ejemplos:

- `CONNECTIVITY_OK` → “La conexión básica funciona correctamente.”
- `VERIFY_CLIENT_CONFIGURATION` → “El siguiente paso es revisar la configuración del cliente VPN.”
- `PENDING_APPROVAL` → “La acción necesita aprobación antes de ejecutarse.”

Conserva los códigos técnicos para auditoría y diagnóstico, pero muéstralos solamente en una sección secundaria o de detalles técnicos.

Incluye en la comunicación:

- estado actual;
- siguiente paso;
- expectativa según prioridad/SLA;
- mensajes de error accionables;
- identificador de seguimiento.

No prometas una resolución antes de verificarla.

4. CUSTOM AGENTS, HERRAMIENTAS Y HANDOFFS

Revisa:

- `.github/agents/triage.agent.md`
- `.github/agents/diagnostic-remediation.agent.md`

Haz que cumplan explícitamente el apartado 2.3 del PDF.

Antes de modificar el formato, verifica la especificación vigente de Custom Agents compatible con este repositorio y no inventes propiedades de frontmatter.

Cada agente debe declarar claramente:

- herramientas permitidas;
- herramientas prohibidas o límites;
- permisos de delegación;
- handoffs permitidos;
- condiciones de cada handoff;
- contexto mínimo transferido;
- condiciones de escalamiento;
- imposibilidad de aprobar su propia remediación.

Debe haber transiciones deterministas y sin ciclos.

Como mínimo:

- Triage → diagnóstico, solo con clasificación soportada y completa.
- Triage → humano, para P1, baja confianza, datos faltantes o categoría no soportada.
- Diagnóstico → aprobación, para riesgo medio.
- Diagnóstico → humano, por fallo de herramienta, evidencia inconclusa o acción prohibida.
- Diagnóstico/remediación → resolución, solo después de verificación exitosa.

No transfieras secretos, PII innecesaria ni razonamiento interno.

5. SKILL Y RECURSO AUXILIAR FUNCIONAL

Revisa:

`.github/skills/diagnose-vpn-connectivity/`

Actualmente contiene `SKILL.md` y esquemas, pero no aparece el recurso auxiliar que la documentación del proyecto promete.

Implementa un recurso funcional, preferiblemente:

`.github/skills/diagnose-vpn-connectivity/scripts/check-vpn-connectivity.ts`

Y sus pruebas correspondientes.

Requisitos del recurso:

- Entrada validada por esquema.
- Salida estructurada validada.
- Sin comandos arbitrarios.
- Endpoints allowlisted.
- Timeout explícito.
- Un único reintento para fallos transitorios.
- Redacción de secretos.
- No registrar IP privadas sin enmascararlas.
- Respuestas deterministas en modo mock.
- `TOOL_UNAVAILABLE` cuando el recurso no responda.
- Escalamiento automático ante fallo, timeout o salida inválida.
- Nunca inventar evidencia.

Asegura que el procedimiento de la skill consuma realmente el recurso o adaptador auxiliar. No dejes archivos decorativos sin integración.

Mantén `LLM_PROVIDER=mock` como valor predeterminado y no requieras ninguna API key.

6. PROMPT FILES

Revisa los archivos de `.github/prompts/`.

Asegura que:

- sean ejecutables y parametrizables;
- usen variables dinámicas;
- indiquen explícitamente las herramientas o skills permitidas;
- validen datos de entrada y salida;
- traten el contenido del ticket como no confiable;
- indiquen los criterios de escalamiento;
- no permitan que texto del usuario se convierta en comandos;
- no permitan resolver sin verificación.

Conserva los prompts concisos. No dupliques toda la lógica del dominio dentro del prompt.

7. FRONTEND

Mejora la experiencia sin reemplazar el diseño existente.

Debe incluir correctamente:

- estados de carga;
- estados vacíos;
- errores accionables;
- botones deshabilitados durante operaciones;
- acciones permitidas según categoría y estado;
- mensajes de éxito;
- detalle de clasificación;
- entidades extraídas;
- SLA/prioridad;
- explicación de escalamiento;
- detalles técnicos opcionales;
- accesibilidad mediante labels, regiones y mensajes anunciables.

Cuando la API devuelva Problem Details, muestra un mensaje seguro basado en `detail` y el `correlationId`, en vez de usar siempre un error genérico.

No muestres el diagnóstico VPN para tickets incompatibles.

Mantén protección contra inyección HTML/XSS mediante interpolación segura. No uses `innerHTML` con contenido del ticket.

8. SEGURIDAD Y PRIVACIDAD

Conserva y amplía las pruebas de:

- redacción de password;
- token;
- Bearer token;
- claves con prefijo `sk-`;
- sanitización de auditoría y logs;
- aislamiento de tickets entre usuarios;
- RBAC;
- acciones prohibidas;
- validación de transiciones;
- aprobación independiente.

No registres secretos, credenciales, PII innecesaria ni cadenas de razonamiento.

No debilites OIDC ni confíes en roles enviados por el frontend cuando `AUTH_MODE=oidc`.

9. TRAZABILIDAD

Todo evento relevante debe conservar:

- actor;
- timestamp UTC;
- `correlationId`;
- ticket;
- tipo de evento;
- resultado;
- metadatos sanitizados.

Añade eventos para intentos rechazados relevantes cuando corresponda, sin almacenar secretos.

Comprueba que la línea de tiempo se mantiene ordenada y append-only.

10. PRUEBAS OBLIGATORIAS

Trabaja con TDD cuando sea razonable: añade o actualiza pruebas que fallen antes de implementar el comportamiento.

Como mínimo, cubre:

- VPN compatible muestra diagnóstico VPN.
- Identidad no muestra diagnóstico VPN.
- Aprovisionamiento no muestra diagnóstico VPN.
- Categoría desconocida escala.
- Baja confianza escala.
- P1 escala.
- Entidades completas y faltantes.
- Traducción de estados y recomendaciones.
- Error de herramienta.
- Timeout.
- Salida inválida.
- Remediación de riesgo bajo.
- Remediación de riesgo medio con aprobación.
- Rechazo de remediación.
- Acción prohibida.
- Resolución sin verificación rechazada.
- Flujo de reapertura.
- Filtros.
- Redacción de secretos.
- Autorización y propiedad del ticket.
- Handoffs sin ciclos.

Añade pruebas de componente para Angular, pruebas unitarias de dominio y pruebas E2E de API.

Si la infraestructura existente lo permite sin introducir dependencias desproporcionadas, añade una prueba E2E del navegador para el flujo principal y otra para identidad.

11. VERIFICACIÓN FINAL

Ejecuta dentro del Dev Container:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm build`

También prueba manualmente en `http://localhost:4200/`:

- creación;
- clasificación;
- diagnóstico VPN;
- remediación de bajo riesgo;
- aprobación de riesgo medio;
- resolución;
- cierre;
- reapertura;
- filtros;
- línea de tiempo;
- ticket de identidad;
- ticket de aprovisionamiento;
- redacción de un token sintético.

No uses secretos reales.

Si una prueba falla, corrige la causa raíz y vuelve a ejecutar la verificación correspondiente.

RESTRICCIONES

- No elimines comportamiento funcional existente.
- No reemplaces PostgreSQL por almacenamiento en memoria fuera de tests.
- No introduzcas una API de IA obligatoria.
- No cambies contratos públicos sin actualizar consumidores, OpenAPI y pruebas.
- No ejecutes migraciones destructivas.
- No borres datos existentes.
- No hagas `git reset --hard`.
- No hagas commit ni push.
- Respeta cualquier `AGENTS.md` presente.
- Mantén Clean Architecture en NestJS y organización feature-first en Angular.
- Evita sobreingeniería y dependencias innecesarias.
- Mantén el repositorio limpio, excepto por los cambios necesarios.

CRITERIOS DE FINALIZACIÓN

No consideres el trabajo terminado hasta que:

1. Las tres tipologías tengan un comportamiento coherente.
2. Ningún ticket no VPN ofrezca diagnóstico VPN.
3. Los dos agentes tengan herramientas, límites y handoffs explícitos.
4. La skill tenga un recurso auxiliar funcional e integrado.
5. Los prompts sean parametrizados y seguros.
6. Las entidades obligatorias estén modeladas.
7. La UI use mensajes comprensibles en español.
8. Todas las pruebas pasen.
9. El build termine correctamente.
10. No queden errores ni advertencias relevantes en la consola del navegador.
11. `git status` solo muestre los archivos modificados intencionalmente.

ENTREGA FINAL

Al terminar, informa:

- resumen de los cambios;
- archivos modificados;
- decisiones de arquitectura;
- nuevas pruebas añadidas;
- resultado exacto de cada comando de verificación;
- flujos comprobados en el navegador;
- limitaciones que todavía permanezcan;
- cualquier migración necesaria;
- `git status --short`.

Incluye una matriz final:

| Requisito del PDF | Implementación | Evidencia | Estado |
|---|---|---|---|

Usa únicamente los estados: `Cumple`, `Cumple parcialmente` o `No cumple`.

Continúa trabajando hasta completar toda la implementación y verificación. No te detengas después de corregir solo el primer defecto.