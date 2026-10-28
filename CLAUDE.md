# ERP · Microfrontend Obras

Microfrontend del ERP para obras: registrar obra, consultar obra (avance, plazo, material) y elaborar y presentar planillas.

Parte de la «Plataforma de supervisión de obras». Si existe `../../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** proyecto generado con Native Federation configurado, sin pantallas. No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

## Stack

- Node 24 · Angular 22 (standalone, builder esbuild) · SCSS · pruebas con Vitest
- `@angular-architects/native-federation` 22 como **remoto**; comparte Angular con el shell
- Previsto: apollo-angular 14 (GraphQL hacia el gateway)
- Puerto: `4201`

## Comandos

```sh
npm install
npm start            # ng serve en http://localhost:4201 (se puede usar solo, sin el shell)
npm test             # ng test (Vitest)
npm run build        # genera dist/mf-obras/browser/remoteEntry.json
```

## Native Federation

- `federation.config.mjs`: `exposes` define lo que carga el shell (hoy `./Component` → `src/app/app.ts`; se ajusta al definir las rutas).
- Las entradas de `@angular/platform-browser/animations` están en `skip` porque no usamos `@angular/animations`.

## Estructura prevista

```
src/app/
  obras/          lista, registro y detalle de obra
  planillas/      elaboración, presentación y corrección
  shared/         componentes comunes
```

## Reglas del proyecto

- Solo habla con el gateway GraphQL.
- Recibe la sesión del shell; no inicia sesión por su cuenta.
- Debe poder levantarse solo para desarrollo.

## Documentación

- `docs/estructura.md`: **librerías permitidas y estructura exacta de carpetas y archivos. Obligatorio leerlo antes de escribir código.**
- `docs/app.md`: pantallas y qué no hace.
- `docs/contratos.md`: qué consume y qué expone.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(planillas): agrega formulario de planilla`). Sin coautoría ni firmas de la IA.

Trabajo en ramas `feat/NNN-nombre` con *pull request* y revisión; nunca hagas *push* a `main` (está protegida). Detalle y definición de terminado: `docs/flujo-trabajo.md` del repo `supervision-docs`.
