# ERP · Microfrontend Obras: qué hace

## Pantallas

| Pantalla | Quién | Caso de uso | Etapa |
|---|---|---|---|
| Lista de obras | Administración, residente, gerente | Consultar obra | Base |
| Registrar obra (datos, contrato, presupuesto por partidas) | Administración | Registrar obra | Base |
| Detalle de obra (avance vs plazo, material usado vs previsto, fotos, planillas; cobros solo administración y gerente) | Administración, residente (sus obras), gerente | Consultar obra | Base |
| Elaborar planilla (cantidades por partida, cálculo, fotos de respaldo) | Residente asignado (administración y gerente la ven en modo lectura) | Elaborar y presentar planilla | Base |
| Etiqueta de casco y chaleco en las fotos de la pestaña «Fotos» (detección hecha en el celular) | Quien ve el detalle de la obra | Consultar obra (301) | Capa 3 |
| Fotos para el cliente con rostros difuminados (al presentar) | Residente asignado | Elaborar y presentar planilla | Capa 3 |
| Riesgo de retraso en el encabezado y consumos atípicos en la pestaña «Material» (marcar «Es normal» o «Confirmar problema»: residente asignado y administración) | Administración, residente (sus obras), gerente | Predicciones | Capa 4 |
| Pestaña «Cobros»: estado del pago («Pagado el dd/mm/aaaa» y comprobante), correos enviados al cliente («Nota enviada», recordatorios, «Constancia enviada» o «Nota sin enviar») y «Registrar pago» (diálogo con fecha y comprobante; solo administración) | Administración, gerente (solo ve) | Cobranza automática (201) | Capa 2 |
| Pestaña «Agentes» (hallazgos y sugerencias; Control de cobros solo administración y gerente) | Administración, residente (sus obras), gerente | Agentes | Capa 5 |

Referencia visual: el prototipo HTML de la carpeta general.

## Qué no hace

- No calcula reglas del negocio por su cuenta: muestra lo que devuelve el gateway (puede adelantar cálculos solo como ayuda visual).
- No gestiona materiales ni el tablero general.
