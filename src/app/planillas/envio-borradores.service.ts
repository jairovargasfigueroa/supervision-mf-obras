import { DestroyRef, Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ConexionService } from '../nucleo/conexion.service';
import { leerError, mensajeDeError, registrarError } from '../nucleo/errores';
import { esFalloDeConexion } from '../nucleo/respaldo.service';
import { EVENTO_CONEXION, EVENTO_SESION, type BorradorPlanilla } from '../nucleo/sesion.service';
import { PlanillasService } from './planillas.service';

/** Cada cuánto se reintenta mientras haya borradores PENDIENTE y conexión (104, diseño). */
export const INTERVALO_ENVIO_MS = 60_000;

/** Errores de una regla del negocio: el borrador queda RECHAZADO con sus errores para corregirlo (criterio 16). */
const RECHAZOS = new Set(['SUPERA_CANTIDAD_CONTRATADA', 'FOTO_FUERA_DEL_PERIODO']);

export type ResultadoEnvio = 'enviado' | 'CONFLICTO' | 'NO_EDITABLE' | 'RECHAZADO' | 'pendiente';

/** «Borrador de la planilla N.º X enviado» (104, criterio 13). */
export function avisoBorradorEnviado(numero: number): string {
  return `Borrador de la planilla N.º ${numero} enviado`;
}

/**
 * Envía los borradores de planilla guardados en el equipo (104, criterios 13 a 16) cuando vuelve la conexión con la
 * sesión activa, y cada 60 s mientras haya borradores PENDIENTE. Arranca al cargar las rutas de mf-obras.
 */
@Injectable()
export class EnvioBorradoresService {
  private readonly planillas = inject(PlanillasService);
  private readonly conexion = inject(ConexionService);
  private readonly avisos = inject(MatSnackBar);
  private enviando = false;

  constructor() {
    const intentar = () => void this.enviarPendientes();
    window.addEventListener(EVENTO_CONEXION, intentar);
    window.addEventListener(EVENTO_SESION, intentar);
    const intervalo = setInterval(intentar, INTERVALO_ENVIO_MS);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener(EVENTO_CONEXION, intentar);
      window.removeEventListener(EVENTO_SESION, intentar);
      clearInterval(intervalo);
    });
  }

  /** Primer intento al cargar mf-obras. */
  iniciar(): void {
    void this.enviarPendientes();
  }

  /** Envía cada borrador PENDIENTE si hay conexión y sesión activa; se detiene ante un fallo de red. */
  async enviarPendientes(): Promise<void> {
    const almacen = window.plataforma?.almacen;
    if (!almacen || this.enviando || !this.puedeEnviar()) return;
    this.enviando = true;
    try {
      const pendientes = (await almacen.listarBorradoresPlanilla()).filter(
        (borrador) => borrador.estadoEnvio === 'PENDIENTE',
      );
      for (const borrador of pendientes) {
        if ((await this.enviar(borrador)) === 'pendiente') break;
      }
    } catch (error) {
      console.error('[mf-obras] No se pudieron enviar los borradores', error);
    } finally {
      this.enviando = false;
    }
  }

  /**
   * «Aplicar mi borrador sobre la última versión» (criterio 14): vuelve a pedir la planilla, cambia `versionBase` por
   * la versión nueva y reenvía.
   */
  async aplicarSobreUltimaVersion(planillaId: string): Promise<ResultadoEnvio> {
    const almacen = window.plataforma?.almacen;
    const borrador = await almacen?.leerBorradorPlanilla(planillaId);
    if (!almacen || !borrador) return 'pendiente';
    try {
      const respuesta = await firstValueFrom(this.planillas.obtener(planillaId));
      if (!respuesta || respuesta.desdeEquipo || !respuesta.datos) return 'pendiente';
      const actualizado: BorradorPlanilla = {
        ...borrador,
        versionBase: respuesta.datos.version,
        estadoEnvio: 'PENDIENTE',
        ultimoError: undefined,
      };
      await almacen.guardarBorradorPlanilla(actualizado);
      return await this.enviar(actualizado);
    } catch (error) {
      if (esFalloDeConexion(error)) this.conexion.reportarFallo();
      registrarError('aplicar borrador', leerError(error));
      return 'pendiente';
    }
  }

  /** Envía un borrador con `guardarPlanilla` y deja su resultado en el almacén. */
  private async enviar(borrador: BorradorPlanilla): Promise<ResultadoEnvio> {
    const almacen = window.plataforma!.almacen!;
    try {
      await firstValueFrom(
        this.planillas.guardar(borrador.planillaId, {
          version: borrador.versionBase,
          lineas: borrador.lineas,
          fotoIds: borrador.fotoIds,
        }),
      );
      await almacen.borrarBorradorPlanilla(borrador.planillaId);
      this.avisos.open(avisoBorradorEnviado(borrador.numero), undefined, { duration: 5000 });
      return 'enviado';
    } catch (error) {
      if (esFalloDeConexion(error)) {
        this.conexion.reportarFallo();
        return 'pendiente';
      }
      const leido = leerError(error);
      registrarError('enviar borrador', leido);
      const estadoEnvio =
        leido.codigo === 'VERSION_DESACTUALIZADA'
          ? 'CONFLICTO'
          : leido.codigo === 'PLANILLA_NO_EDITABLE'
            ? 'NO_EDITABLE'
            : leido.codigo && RECHAZOS.has(leido.codigo)
              ? 'RECHAZADO'
              : null;
      // Otro error (sesión vencida, permiso, servicio caído): sigue PENDIENTE para el siguiente intento
      if (!estadoEnvio) return 'pendiente';
      await almacen.guardarBorradorPlanilla({
        ...borrador,
        estadoEnvio,
        ultimoError: {
          codigo: leido.codigo!,
          mensaje: mensajeDeError(leido),
          errores: leido.errores,
        },
      });
      return estadoEnvio;
    }
  }

  private puedeEnviar(): boolean {
    const sesion = window.plataforma?.sesion;
    const enLinea = window.plataforma?.conexion?.enLinea ?? this.conexion.enLinea();
    return enLinea && !!sesion && !sesion.sinConexion;
  }
}
