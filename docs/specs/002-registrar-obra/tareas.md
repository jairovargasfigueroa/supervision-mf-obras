# 002 · Registrar obra · tareas de `frontend/mf-obras`

Requisitos y diseño: `docs/specs/002-registrar-obra/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Instalar `apollo-angular` 14 + `@apollo/client` 4 + `graphql`; configurar el cliente con el token del shell (hecho en la tarea 1.10 de la fase 1, esqueleto que camina: `nucleo/graphql.config.ts`, provisto en las rutas expuestas de `app.routes.ts`)
- [x] Ruta `/obras/nueva`: formulario de 3 pasos con validaciones y selección de usuarios por rol
- [x] Paso 3: partidas e insumos dinámicos, total en vivo y diferencia con el monto (partidas dinámicas; los insumos quedan para cuando el gateway tenga `materiales`, de la 003: el diseño permite partidas sin insumos)
- [ ] Guardar con `registrarObra`, mostrar errores por `codigo` y navegar al detalle con espera «Registrando contrato…»
- [ ] Pruebas del cálculo del total y de la validación
