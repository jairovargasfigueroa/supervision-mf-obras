# ERP · Microfrontend Obras: qué hace

## Pantallas

| Pantalla | Quién | Caso de uso | Etapa |
|---|---|---|---|
| Lista de obras | Administración, residente, gerente | Consultar obra | Base |
| Registrar obra (datos, contrato, presupuesto por partidas) | Administración | Registrar obra | Base |
| Detalle de obra (avance vs plazo, material usado vs previsto, fotos, planillas) | Residente, gerente | Consultar obra | Base |
| Elaborar planilla (cantidades por partida, cálculo, fotos de respaldo) | Residente | Elaborar y presentar planilla | Base |

Referencia visual: el prototipo HTML de la carpeta general.

## Qué no hace

- No calcula reglas del negocio por su cuenta: muestra lo que devuelve el gateway (puede adelantar cálculos solo como ayuda visual).
- No gestiona materiales ni el tablero general.
