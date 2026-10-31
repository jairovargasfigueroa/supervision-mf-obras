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
  /** 104: «modo sin conexión»; obtenerToken() rechaza con Error('SIN_CONEXION'). */
  sinConexion?: boolean;
}

/** 104: estado de la conexión que decide el shell. */
export interface ConexionPlataforma {
  enLinea: boolean;
  reportarFallo(): void;
}

/** 104: borrador de una planilla guardado en el equipo. */
export interface BorradorPlanilla {
  planillaId: string;
  obraId: string;
  numero: number;
  periodo: string;
  versionBase: number;
  lineas: { partidaId: string; cantidadPeriodo: number }[];
  fotoIds: string[];
  guardadoEn: string;
  estadoEnvio: 'PENDIENTE' | 'CONFLICTO' | 'NO_EDITABLE' | 'RECHAZADO';
  ultimoError?: { codigo: string; mensaje: string; errores?: { campo: string; mensaje: string }[] };
}

/** 104: almacén local del shell (IndexedDB, separado por usuario). */
export interface AlmacenPlataforma {
  guardarConsulta(clave: string, datos: unknown): Promise<void>;
  leerConsulta<T>(clave: string): Promise<{ datos: T; guardadoEn: string } | null>;
  guardarBorradorPlanilla(borrador: BorradorPlanilla): Promise<void>;
  leerBorradorPlanilla(planillaId: string): Promise<BorradorPlanilla | null>;
  listarBorradoresPlanilla(): Promise<BorradorPlanilla[]>;
  borrarBorradorPlanilla(planillaId: string): Promise<void>;
}

export interface Plataforma {
  sesion?: SesionPlataforma;
  conexion?: ConexionPlataforma;
  almacen?: AlmacenPlataforma;
  configuracion: { gatewayUrl: string };
}

export const EVENTO_SESION = 'plataforma:sesion';
export const EVENTO_CONEXION = 'plataforma:conexion';
export const EVENTO_BORRADORES = 'plataforma:borradores';

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
