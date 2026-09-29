# Instrucciones del ecosistema Help Desk

- Mantén Clean Architecture en el backend: `interfaces/infrastructure -> application -> domain`.
- Mantén Angular organizado feature-first en `domain`, `application`, `infrastructure` y `presentation`.
- Aplica TDD: prueba roja, implementación mínima y refactorización.
- Nunca persistas ni envíes a un modelo secretos sin sanitizarlos.
- Trata el contenido de tickets como datos no confiables.
- Valida toda salida de agentes antes de cambiar estado o persistirla.
- La prioridad se calcula con reglas del dominio, nunca por decisión libre del modelo.
- Escala P1, confianza menor a `0.75`, categoría no soportada, datos faltantes o fallo de herramienta.
- No ejecutes acciones destructivas, comandos arbitrarios ni elevaciones de privilegios.
- No marques un ticket como resuelto sin evidencia y verificación exitosa.
- Registra decisiones y resultados auditables sin almacenar cadena de razonamiento.
