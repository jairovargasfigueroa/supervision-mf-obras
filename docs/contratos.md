# ERP · Microfrontend Obras: contratos

**Estado:** lo de abajo es lo conocido; las operaciones exactas se definen en el `diseno.md` de cada funcionalidad.

## Consume

- Gateway GraphQL: áreas obras, planillas, finanzas (contrato y saldo) y materiales (consumos frente a previsto).
  - 1.10: `obras` (lista).
  - 002: `usuarios(rol)` (listas de asignación), `registrarObra(entrada)` (pide solo `id` y `estado`) y `obra(id)` básica (datos, `motivoRechazoContrato`, asignaciones, `contrato` y `partidas`). `materiales(soloActivos: true)` para los insumos se usará cuando el gateway la tenga (003); hasta entonces las partidas se registran sin insumos.
  - 006: `obras(estado, busqueda)` con `avancePct`, `plazoPct` y `enRiesgo`. Detalle `obra(id)` en varias consultas, según el SDL de `docs/contratos/graphql-erp.md`:
    - principal (encabezado, asignaciones, contrato, indicadores y `partidas` con `ejecutadaAcumulada` y `avancePct`), con `errorPolicy: 'all'`: si llega la obra con errores en campos secundarios (nombres de Keycloak), se muestra igual; sin obra, `OBRA_NO_ENCONTRADA` → «Obra no encontrada»;
    - `finanzas { saldoDisponible totalCobrado }`, solo para `admin` y `gerente` y cuando la obra ya tiene `contrato.contratoId`;
    - una por pestaña, al abrirla: `materialComparado(periodo: "AAAA-MM")` (con `material { id codigo nombre unidad unidadPlural }`), `fotos(pagina, tamano: 50)` (005; con `registradoPor { id nombre }`), `planillas { id numero periodo estado neto }` (007) y `cobros` (solo `admin` y `gerente`).
    - Si una de esas consultas falla (`SERVICIO_NO_DISPONIBLE`, tiempo agotado), solo su sección muestra «No disponible por el momento» con «Reintentar». Si el gateway todavía no expone `planillas` (error de validación del esquema), la pestaña muestra el estado vacío.
  - 007: `planillas` del detalle ya expuesta por el gateway. «Nueva planilla» (`/obras/{id}/planillas/nueva`, solo el `residente` asignado y con la obra `EN_EJECUCION`): `obra(id) { id nombre estado fechaInicio residente { id nombre } }` (con `errorPolicy: 'all'`), `planillas` (solo para completar `{periodoUltima}`) y `crearPlanilla(obraId, periodo)`; ofrece los meses desde el inicio de la obra hasta el actual. Errores `PLANILLA_ABIERTA_EXISTE`, `PERIODO_NO_POSTERIOR`, `PERIODO_FUTURO` y `OBRA_NO_EN_EJECUCION` con su texto.
  - Errores: `extensions.codigo` → texto de `docs/mensajes.md` en `nucleo/errores.ts`.
- Shell: sesión del usuario en `window.plataforma.sesion` (token con `obtenerToken()`).

## Expone

- Módulo remoto por Native Federation, montado por el shell en su ruta.
