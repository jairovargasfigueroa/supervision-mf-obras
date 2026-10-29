import { Routes } from '@angular/router';
import { ObrasListaComponent } from './obras/lista/obras-lista.component';

// Rutas expuestas al shell como ./Routes (se montan bajo /obras) y usadas también al desarrollar solo en el 4201
export const routes: Routes = [{ path: '', component: ObrasListaComponent }];
