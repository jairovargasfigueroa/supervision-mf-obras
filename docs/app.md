# ERP · Microfrontend Obras: qué hace

## Pantallas

| Pantalla | Quién | Caso de uso | Etapa |
|---|---|---|---|
| Lista de obras | Administración, residente, gerente | Consultar obra | Base |
| Registrar obra (datos, contrato, presupuesto por partidas) | Administración | Registrar obra | Base |
| Detalle de obra (avance vs plazo, material usado vs previsto, fotos, planillas; cobros solo administración y gerente) | Administración, residente (sus obras), gerente | Consultar obra | Base |
| Elaborar planilla (cantidades por partida, cálculo, fotos de respaldo) | Residente asignado (administración y gerente la ven en modo lectura) | Elaborar y presentar planilla | Base |
| Fotos para el cliente con rostros difuminados (al presentar) | Residente asignado | Elaborar y presentar planilla | Capa 3 |
| Riesgo de retraso en el encabezado y consumos atípicos en la pestaña «Material» (marcar «Es normal» o «Confirmar problema»: residente asignado y administración) | Administración, residente (sus obras), gerente | Predicciones | Capa 4 |
| Pestaña «Agentes» (hallazgos y sugerencias; Control de cobros solo administración y gerente) | Administración, residente (sus obras), gerente | Agentes | Capa 5 |

Referencia visual: el prototipo HTML de la carpeta general.

## Qué no hace

- No calcula reglas del negocio por su cuenta: muestra lo que devuelve el gateway (puede adelantar cálculos solo como ayuda visual).
- No gestiona materiales ni el tablero general.
