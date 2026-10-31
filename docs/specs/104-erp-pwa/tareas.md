# 104 · ERP sin conexión (PWA) · tareas de `frontend/mf-obras`

Requisitos y diseño: `docs/specs/104-erp-pwa/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto. Requiere la tarea del almacén y la conexión en erp-shell.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Servicio `consultaConRespaldo` y componente de aviso «Sin conexión · datos del …»
- [x] Usarlo en la lista de obras, el detalle (encabezado y pestañas) y la planilla
- [ ] Deshabilitar acciones de escritura sin conexión («Requiere conexión»)
- [ ] Editor: guardar borrador local sin conexión o ante error de red; mostrar el borrador al abrir; «Presentar» deshabilitado con borrador
- [ ] `EnvioBorradoresService`: envío al reconectar y cada 60 s; manejo de `VERSION_DESACTUALIZADA`, `PLANILLA_NO_EDITABLE` y errores de validación con sus diálogos
- [ ] Galería de fotos sin conexión con recuadro en lugar de la miniatura
- [ ] Pruebas de la spec
