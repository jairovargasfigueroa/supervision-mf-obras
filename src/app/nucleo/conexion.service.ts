import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { EVENTO_CONEXION } from './sesion.service';

/** Ayuda de los botones que escriben cuando no hay conexión (104, criterio 9). */
export const REQUIERE_CONEXION = 'Requiere conexión';

/**
 * Estado de la conexión que decide el shell (window.plataforma.conexion, 104). Sin el shell (desarrollo en el 4201)
 * se considera en línea. Se actualiza con el evento plataforma:conexion.
 */
@Injectable({ providedIn: 'root' })
export class ConexionService {
  readonly enLinea = signal(window.plataforma?.conexion?.enLinea ?? true);

  constructor() {
    const actualizar = () => this.enLinea.set(window.plataforma?.conexion?.enLinea ?? true);
    window.addEventListener(EVENTO_CONEXION, actualizar);
    inject(DestroyRef).onDestroy(() => window.removeEventListener(EVENTO_CONEXION, actualizar));
  }

  /** Avisa al shell que una consulta falló por la red o por tiempo agotado. */
  reportarFallo(): void {
    window.plataforma?.conexion?.reportarFallo();
    this.enLinea.set(window.plataforma?.conexion?.enLinea ?? this.enLinea());
  }
}
