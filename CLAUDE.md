# ERP · Microfrontend Obras

Microfrontend del ERP para obras: registrar obra, consultar obra (avance, plazo, material) y elaborar y presentar planillas.

Parte de la «Plataforma de supervisión de obras». Si existe `../../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** fase 1. Expone sus rutas (`./Routes`) al shell, lee la sesión de `window.plataforma` y tiene tema, formato y estados vacío y error. La lista de obras consulta `obras` al gateway (esqueleto que camina, 1.10). 002: asistente «Nueva obra» (`/obras/nueva`, solo `admin`) con `usuarios(rol)` y `registrarObra`, y detalle básico (`/obras/{id}`) que espera el contrato consultando `obra(id)` cada 2 s (máx. 30 s). 006: lista con filtros (estado, búsqueda por nombre), plazo y «En riesgo»; detalle con encabezado, indicadores, contrato (saldo y total cobrado para `admin` y `gerente`), partidas y pestañas Material, Fotos (galería de la 005), Planillas y Cobros, cada una con su consulta y su «No disponible por el momento». 007: «Nueva planilla» (`/obras/{id}/planillas/nueva`, solo el residente asignado) y editor (`/obras/planillas/{id}`: cantidades, totales en vivo con `totales.ts`, filas que superan lo contratado, fotos del periodo, «Guardar» con bloqueo optimista y «Presentar»; modo lectura para estados no editables y para `admin` y `gerente`). 401: selector «Zona» (opcional) en «Nueva obra» y zona en la lista y el detalle («Sin zona» si no tiene). No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

## Stack

- Node 24 · Angular 22 (standalone, builder esbuild) · SCSS · pruebas con Vitest
- `@angular-architects/native-federation` 22 como **remoto**; comparte Angular con el shell
- apollo-angular 14 + Apollo Client 4 (GraphQL hacia el gateway, con el token del shell); se proveen en las rutas expuestas
- Puerto: `4201`

## Comandos

```sh
npm install
npm start            # ng serve en http://localhost:4201 (se puede usar solo, sin el shell)
npm test             # ng test (Vitest)
npm run build        # genera dist/mf-obras/browser/remoteEntry.json
```

## Native Federation

- `federation.config.mjs`: expone `./Routes` → `src/app/app.routes.ts`; el shell las monta bajo `/obras`.
- Las entradas de `@angular/platform-browser/animations` están en `skip` porque no usamos `@angular/animations`.

## Estructura

Ver `docs/estructura.md` (`nucleo/`, `obras/`, `planillas/`, `compartido/`).

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

Git Flow: ramas `feat/`, `fix/`, `docs/`… desde `develop`, que entran por *pull request*; nunca hagas *push* a `main` ni a `develop` (están protegidas). El agente crea y fusiona los PR (merge normal, sin squash) hacia `develop` cuando todas las pruebas pasan. Detalle y definición de terminado: `docs/flujo-trabajo.md` del repo `supervision-docs`.
