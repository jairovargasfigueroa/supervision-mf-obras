import { DestroyRef, Injectable, inject, signal } from '@angular/core';

// Copia del contrato de window.plataforma que publica el shell (erp-shell/src/app/sesion/sesion-global.ts).
export interface UsuarioSesion {
  id: string;
  nombre: string;
  roles: string[];
}

export interface SesionPlataforma {
  usuario: UsuarioSesion;
  obtenerToken(): Promise<string>;
  cerrarSesion(): void;
}

export interface Plataforma {
  sesion?: SesionPlataforma;
  configuracion: { gatewayUrl: string };
}

export const EVENTO_SESION = 'plataforma:sesion';

declare global {
  interface Window {
    plataforma?: Plataforma;
  }
}

/** URL del gateway para desarrollar sin el shell (docs/entorno-local.md). */
const GATEWAY_DESARROLLO = 'http://localhost:4000/graphql';

/**
 * Lee la sesión que publica el shell en window.plataforma; nunca habla con Keycloak (convenciones,
 * «Sesión dentro del ERP»). Se actualiza con el evento plataforma:sesion.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  /** false si el microfrontend se abrió solo, sin el shell: se muestra «Abre esta pantalla desde el ERP». */
  readonly dentroDelErp = signal(window.plataforma !== undefined);
  readonly usuario = signal<UsuarioSesion | null>(window.plataforma?.sesion?.usuario ?? null);

  constructor() {
    const actualizar = () => {
      this.dentroDelErp.set(window.plataforma !== undefined);
      this.usuario.set(window.plataforma?.sesion?.usuario ?? null);
    };
    window.addEventListener(EVENTO_SESION, actualizar);
    inject(DestroyRef).onDestroy(() => window.removeEventListener(EVENTO_SESION, actualizar));
  }

  get gatewayUrl(): string {
    return window.plataforma?.configuracion.gatewayUrl ?? GATEWAY_DESARROLLO;
  }

  /** Token vigente que entrega el shell; vacío si no hay sesión. */
  async obtenerToken(): Promise<string> {
    return (await window.plataforma?.sesion?.obtenerToken()) ?? '';
  }
}
