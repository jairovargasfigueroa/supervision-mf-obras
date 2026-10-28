# ERP · Microfrontend Obras: estructura y librerías

Obligatorio para todo el código de este proyecto.

## Librerías

Angular 22 (standalone, *signals*), `@angular/material` + `@angular/cdk` 22 (compartidos con el shell por Native Federation), Material Symbols, `apollo-angular` 14 + `@apollo/client` 4 + `graphql` 16, Reactive Forms tipados. Sin NgRx. Pruebas con Vitest.

## Tema

El shell aplica el tema global. Para desarrollar solo (`npm start` en 4201), `src/styles.scss` importa una copia de `tema.scss` del shell con los mismos valores (primario `#0E4D5C`, acento `#F08A24`; ver `docs/diseno-visual.md` de la carpeta general).

## Árbol

```
src/
  main.ts / bootstrap.ts
  styles.scss
  app/
    app.routes.ts                    # rutas expuestas al shell: '', ':id', 'nueva', ':id/planillas/nueva', 'planillas/:id'
    app.config.ts                    # Apollo con el token de window.plataforma.sesion
    nucleo/
      sesion.service.ts              # lee window.plataforma.sesion (signals)
      graphql.config.ts
      errores.ts                     # extensions.codigo → mensaje para el usuario
      formato.ts
    obras/
      lista/        obras-lista.component.ts (+ .html, .scss)
      nueva/        obra-nueva.component.ts, paso-datos.component.ts, paso-contrato.component.ts, paso-presupuesto.component.ts, presupuesto.ts (cálculo puro)
      detalle/      obra-detalle.component.ts, pestana-material.component.ts, pestana-fotos.component.ts, pestana-planillas.component.ts, pestana-cobros.component.ts
      obras.graphql.ts               # documentos gql de esta área
      obras.service.ts               # usa Apollo; devuelve signals o observables
    planillas/
      nueva/        planilla-nueva.component.ts
      editor/       planilla-editor.component.ts, totales.ts (cálculo puro, solo ayuda visual)
      planillas.graphql.ts, planillas.service.ts
    compartido/     estado-chip.component.ts, estado-vacio.component.ts, estado-error.component.ts
federation.config.mjs                # expone las rutas (./Routes) para el shell
```

## Reglas

- Un componente por archivo, standalone, `OnPush`; plantillas en `.html` cuando pasan de 20 líneas.
- Toda llamada de datos por `*.service.ts` + Apollo; los componentes no usan Apollo directo.
- Tablas con `mat-table` (CDK); formularios con `mat-form-field`; diálogos con `MatDialog`.
- Los cálculos (`presupuesto.ts`, `totales.ts`) son funciones puras con pruebas.

## Pruebas

Unitarias de funciones puras y de componentes con Vitest (Angular CLI).
