# ERP · Microfrontend Obras: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

- Gateway GraphQL: áreas obras, planillas, finanzas (contrato y saldo) y materiales (consumos frente a previsto).
  - 1.10: `obras` (lista).
  - 002: `usuarios(rol)` (listas de asignación), `registrarObra(entrada)` (pide solo `id` y `estado`) y `obra(id)` básica (datos, `motivoRechazoContrato`, asignaciones, `contrato` y `partidas`). `materiales(soloActivos: true)` para los insumos se usará cuando el gateway la tenga (003); hasta entonces las partidas se registran sin insumos.
  - Errores: `extensions.codigo` → texto de `docs/mensajes.md` en `nucleo/errores.ts`.
- Shell: sesión del usuario en `window.plataforma.sesion` (token con `obtenerToken()`).

## Expone

- Módulo remoto por Native Federation, montado por el shell en su ruta.
