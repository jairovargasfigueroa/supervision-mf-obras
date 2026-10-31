# ERP · Microfrontend Obras: estructura y librerías

Obligatorio para todo el código de este proyecto.

## Librerías

Angular 22 (standalone, *signals*), `@angular/material` + `@angular/cdk` 22 (compartidos con el shell por Native Federation), Material Symbols, `apollo-angular` 14 + `@apollo/client` 4 + `graphql` 16, Reactive Forms tipados. Sin NgRx. Pruebas con Vitest.

## Tema

El shell aplica el tema global. Para desarrollar solo (`npm start` en 4201), `src/styles.scss` importa una copia de `tema.scss` y `_theme-colors.scss` del shell (`src/styles/`) con los mismos valores (primario `#0E4D5C`, acento `#F08A24`; ver `docs/diseno-visual.md` de la carpeta general).

## Árbol

```
src/
  main.ts / bootstrap.ts
  styles.scss
  app/
    app.routes.ts                    # rutas expuestas al shell: '', ':id', 'nueva', ':id/planillas/nueva', 'planillas/:id' (dentro del ERP, bajo /obras: /obras/{id}/planillas/nueva y /obras/planillas/{id})
    app.config.ts                    # Apollo con el token de window.plataforma.sesion
    nucleo/
      sesion.service.ts              # lee window.plataforma.sesion (signals); copia de los tipos de window.plataforma
      conexion.service.ts            # 104: window.plataforma.conexion como signal (enLinea) y «Requiere conexión»
      respaldo.service.ts            # 104: consultaConRespaldo (guarda la última respuesta completa; sin conexión, la del equipo)
      plataforma-falsa.ts            # solo pruebas: window.plataforma con conexión y almacén en memoria
      graphql.config.ts
      errores.ts                     # extensions.codigo → mensaje para el usuario
      formato.ts                     # montos, cantidades, porcentajes, fechas y periodos («Noviembre 2026»)
      periodos.ts                    # mes actual en La Paz y meses desde el inicio de la obra (cálculo puro)
    obras/
      lista/        obras-lista.component.ts (+ .html, .scss)
      nueva/        obra-nueva.component.ts, paso-datos.component.ts, paso-contrato.component.ts, paso-presupuesto.component.ts, formulario.ts (formulario tipado, validadores y conversión a la entrada), presupuesto.ts (cálculo puro)
      detalle/      obra-detalle.component.ts, pestana-material.component.ts, pestana-fotos.component.ts, pestana-planillas.component.ts, pestana-cobros.component.ts (cada uno con su .html), pestana.scss (estilos comunes de las pestañas), riesgo-modelo.component.ts (402: riesgo del modelo en el encabezado), consumos-atipicos.component.ts (+ .html, .scss; 403: sección de la pestaña Material), revision-dialogo.component.ts (403: «Es normal» y «Confirmar problema»)
      obras.graphql.ts               # documentos gql de esta área
      obras.service.ts               # usa Apollo; devuelve signals o observables
    planillas/
      nueva/        planilla-nueva.component.ts (+ .html; esResidenteAsignado, que usa también el detalle)
      editor/       planilla-editor.component.ts (+ .html, .scss), totales.ts (cálculo puro, solo ayuda visual), borrador-dialogo.component.ts (104: conflicto o planilla no editable)
      planillas.graphql.ts, planillas.service.ts
      envio-borradores.service.ts    # 104: envía los borradores locales al volver la conexión y cada 60 s (se provee en las rutas)
      planillas.scss                 # estilos comunes de nueva y editor
    compartido/     estado-chip.component.ts (estados de obra, planilla y cobro, «En riesgo» y «Excedido»), estado-vacio.component.ts, estado-error.component.ts, aviso-sin-conexion.component.ts (104: «Sin conexión · datos del …» o «No hay datos guardados de esta pantalla»), requiere-conexion.component.ts (104: ayuda «Requiere conexión» de los botones que escriben)
federation.config.mjs                # expone las rutas (./Routes) para el shell
```

## Reglas

- Un componente por archivo, standalone, `OnPush`; plantillas en `.html` cuando pasan de 20 líneas.
- Toda llamada de datos por `*.service.ts` + Apollo; los componentes no usan Apollo directo.
- Tablas con `mat-table` (CDK); formularios con `mat-form-field`; diálogos con `MatDialog`.
- Los cálculos (`presupuesto.ts`, `totales.ts`) son funciones puras con pruebas.

## Pruebas

Unitarias de funciones puras y de componentes con Vitest (Angular CLI).
