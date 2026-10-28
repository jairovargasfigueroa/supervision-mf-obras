# ERP · Microfrontend Obras: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

- Gateway GraphQL: áreas obras, planillas, finanzas (contrato y saldo) y materiales (consumos frente a previsto).
- Shell: sesión del usuario en `window.plataforma.sesion` (token con `obtenerToken()`).

## Expone

- Módulo remoto por Native Federation, montado por el shell en su ruta.
