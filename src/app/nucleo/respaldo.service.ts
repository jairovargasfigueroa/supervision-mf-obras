import { Injectable, inject } from '@angular/core';
import type { DocumentNode, OperationDefinitionNode } from 'graphql';
import { catchError, defer, from, map, tap, type Observable } from 'rxjs';
import { ConexionService } from './conexion.service';
import { leerError } from './errores';

/** Respuesta de una consulta: `completa` es false si llegó con errores en algún campo (respuesta parcial). */
export interface ResultadoConsulta<T> {
  datos: T;
  completa: boolean;
}

/** Datos de una pantalla: de la red o, sin conexión, los guardados en el equipo con su fecha. */
export interface ConRespaldo<T> {
  datos: T;
  desdeEquipo: boolean;
  /** ISO; solo cuando `desdeEquipo` */
  guardadoEn: string | null;
}

/** `"{nombreOperacion}:{JSON.stringify(variables)}"` (104, diseño). */
export function claveConsulta(
  documento: DocumentNode,
  variables: Record<string, unknown> = {},
): string {
  const operacion = documento.definitions.find(
    (d): d is OperationDefinitionNode => d.kind === 'OperationDefinition',
  );
  return `${operacion?.name?.value ?? 'consulta'}:${JSON.stringify(variables)}`;
}

/** Falla por la red, por tiempo agotado o porque el shell está en «modo sin conexión» (SIN_CONEXION). */
export function esFalloDeConexion(error: unknown): boolean {
  const leido = leerError(error);
  return leido.red || leido.estado === 504 || leido.codigo === 'TIEMPO_AGOTADO';
}

/**
 * `consultaConRespaldo` del diseño de la 104: guarda en el equipo la última respuesta completa de cada consulta y,
 * sin conexión o si la red falla, devuelve la guardada (o null si la pantalla nunca se abrió en este equipo). Si el
 * shell no publica el almacén (desarrollo sin el shell), solo ejecuta la consulta.
 */
@Injectable({ providedIn: 'root' })
export class RespaldoService {
  private readonly conexion = inject(ConexionService);

  consultaConRespaldo<T>(
    clave: string,
    ejecutar: () => Observable<ResultadoConsulta<T>>,
  ): Observable<ConRespaldo<T> | null> {
    const almacen = window.plataforma?.almacen;
    const desdeLaRed = (): Observable<ConRespaldo<T>> =>
      ejecutar().pipe(
        tap((resultado) => {
          // Las respuestas parciales se muestran pero no reemplazan una completa (decisión del equipo)
          if (almacen && resultado.completa) {
            void almacen.guardarConsulta(clave, resultado.datos).catch(() => undefined);
          }
        }),
        map((resultado) => ({ datos: resultado.datos, desdeEquipo: false, guardadoEn: null })),
      );
    if (!almacen) {
      return desdeLaRed();
    }
    const desdeElEquipo = (): Observable<ConRespaldo<T> | null> =>
      from(almacen.leerConsulta<T>(clave).catch(() => null)).pipe(
        map((guardada) =>
          guardada
            ? { datos: guardada.datos, desdeEquipo: true, guardadoEn: guardada.guardadoEn }
            : null,
        ),
      );

    return defer(() => {
      if (!this.conexion.enLinea()) {
        return desdeElEquipo();
      }
      return desdeLaRed().pipe(
        catchError((error: unknown) => {
          if (!esFalloDeConexion(error)) throw error;
          this.conexion.reportarFallo();
          return desdeElEquipo();
        }),
      );
    });
  }
}

/** Para las consultas sin respuesta parcial: toda respuesta que llega es completa. */
export function completa<T>(datos$: Observable<T>): Observable<ResultadoConsulta<T>> {
  return datos$.pipe(map((datos) => ({ datos, completa: true })));
}
