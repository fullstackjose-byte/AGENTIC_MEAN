# Mejora UX: formulario y paginación de solicitudes

## Problema observado

El formulario de creación ocupaba la misma altura que el listado porque ambas columnas se estiraban dentro del grid. Además, la acción **Cargar más** acumulaba tarjetas y hacía crecer la página indefinidamente.

## Decisiones de diseño

- El formulario conserva su altura natural y no crece con el listado.
- En escritorio, el formulario permanece visible mediante `position: sticky` mientras se consultan solicitudes.
- En pantallas menores a 860 px, el formulario vuelve al flujo normal para no reducir el espacio disponible.
- La descripción tiene una altura inicial cómoda y solo puede redimensionarse verticalmente dentro de límites razonables.
- El listado muestra tres solicitudes por página porque cada tarjeta puede contener clasificación, acciones y trazabilidad.
- En escritorio, el panel de solicitudes tiene una altura máxima vinculada al viewport y desplazamiento interno; así no alarga el documento completo.
- La paginación utiliza los cursores opacos del backend; Angular no replica reglas de consulta ni carga todos los registros en memoria.
- **Anterior** y **Siguiente** reemplazan el contenido visible, por lo que la pantalla mantiene una longitud predecible.
- Al aplicar filtros o crear un ticket se regresa a la primera página.
- Los controles tienen etiqueta accesible, anuncian la página actual y se deshabilitan durante la carga.

## Comportamiento esperado

1. La primera carga solicita tres tickets.
2. **Siguiente** usa `pageInfo.nextCursor` y sustituye las tarjetas actuales.
3. **Anterior** reutiliza el cursor guardado de la página previa.
4. Los filtros reinician el historial de cursores.
5. Un ticket recién creado aparece al volver a consultar la primera página.

## Validación

```bash
pnpm --filter @helpdesk/web test
pnpm --filter @helpdesk/web typecheck
pnpm --filter @helpdesk/web build
```

La comprobación visual debe realizarse en escritorio y móvil, confirmando que el formulario no se estira y que nunca se acumulan páginas de solicitudes en la vista.
