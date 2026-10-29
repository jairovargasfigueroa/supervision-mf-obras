# 001 · Iniciar sesión y paso entre aplicaciones · tareas de `frontend/mf-obras`

Requisitos y diseño: `docs/specs/001-iniciar-sesion/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] `SesionService` que lee `window.plataforma.sesion` e interceptor que agrega el token (adelantada en la fase 1, tareas 1.8 y 1.10: el token lo agrega el link de Apollo en `nucleo/graphql.config.ts`)
- [x] Mensaje «Abre esta pantalla desde el ERP» si no hay sesión del shell (adelantada en la fase 1, tarea 1.8)
