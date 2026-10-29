import { MAT_FORM_FIELD_DEFAULT_OPTIONS, type MatFormFieldDefaultOptions } from '@angular/material/form-field';
import { Routes } from '@angular/router';
import { provideGraphql } from './nucleo/graphql.config';
import { ObraDetalleComponent } from './obras/detalle/obra-detalle.component';
import { ObrasListaComponent } from './obras/lista/obras-lista.component';
import { ObraNuevaComponent } from './obras/nueva/obra-nueva.component';
import { ObrasService } from './obras/obras.service';
import { PlanillaEditorComponent } from './planillas/editor/planilla-editor.component';
import { PlanillaNuevaComponent } from './planillas/nueva/planilla-nueva.component';
import { PlanillasService } from './planillas/planillas.service';

// Rutas expuestas al shell como ./Routes (se montan bajo /obras) y usadas también al desarrollar solo en el 4201.
// Apollo y los servicios se proveen aquí porque dentro del ERP no se usa app.config.ts.
export const routes: Routes = [
  {
    path: '',
    providers: [
      provideGraphql(),
      ObrasService,
      PlanillasService,
      // Con la densidad -2 del ERP, el campo «fill» oculta su etiqueta; «outline» la conserva
      {
        provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
        useValue: { appearance: 'outline' } satisfies MatFormFieldDefaultOptions,
      },
    ],
    children: [
      { path: '', component: ObrasListaComponent },
      // 002: solo admin; la pantalla muestra «No tienes permiso…» a los demás roles
      { path: 'nueva', component: ObraNuevaComponent, title: 'Nueva obra' },
      // 007: editor (residente asignado) o lectura (admin, gerente y estados no editables); en el ERP, /obras/planillas/{id}
      { path: 'planillas/:id', component: PlanillaEditorComponent, title: 'Planilla' },
      // Detalle básico (002); la 006 agrega las pestañas
      { path: ':id', component: ObraDetalleComponent },
      // 007: solo el residente asignado; los demás ven «No tienes permiso…»
      { path: ':id/planillas/nueva', component: PlanillaNuevaComponent, title: 'Nueva planilla' },
    ],
  },
];
