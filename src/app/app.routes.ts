import { Routes } from '@angular/router';
import { provideGraphql } from './nucleo/graphql.config';
import { ObrasListaComponent } from './obras/lista/obras-lista.component';
import { ObrasService } from './obras/obras.service';

// Rutas expuestas al shell como ./Routes (se montan bajo /obras) y usadas también al desarrollar solo en el 4201.
// Apollo y los servicios se proveen aquí porque dentro del ERP no se usa app.config.ts.
export const routes: Routes = [
  {
    path: '',
    providers: [provideGraphql(), ObrasService],
    children: [{ path: '', component: ObrasListaComponent }],
  },
];
