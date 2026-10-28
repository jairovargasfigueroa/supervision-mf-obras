# 303 · Rostros difuminados · tareas de `frontend/mf-obras`

Requisitos y diseño: `docs/specs/303-rostros-difuminados/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Instalar `@mediapipe/tasks-vision` 1; copiar los archivos WASM y `blaze_face_short_range.tflite` a `public/modelos/mediapipe/`; carga diferida con `import()`
- [ ] `detector-rostros.ts` (imagen completa + mosaicos de 512 px, NMS) y `difuminar.ts`; pruebas de las funciones puras
- [ ] `preparar-fotos-cliente.service.ts`: descarga, detección, difuminado, subida con URL firmada y registro, con reintento por foto; pruebas con dependencias simuladas
- [ ] Diálogo de vista previa: contador de rostros, rectángulos a mano, «Volver a preparar», «Quitar de la planilla» y «Confirmar y presentar»; integrado al botón «Presentar» del editor
- [ ] Medir con las 30 fotos de prueba la sensibilidad y el tiempo por foto (resultado anotado aquí)
