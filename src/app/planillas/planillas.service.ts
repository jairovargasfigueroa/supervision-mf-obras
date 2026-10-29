import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { EMPTY, expand, map, reduce, type Observable } from 'rxjs';
import { periodoDe } from '../nucleo/periodos';
import { CONSULTA_FOTOS, type Foto, type FotosPagina } from '../obras/obras.graphql';
import {
  CONSULTA_OBRA_DE_PLANILLA,
  CONSULTA_PLANILLA,
  MUTACION_CREAR_PLANILLA,
  MUTACION_GUARDAR_PLANILLA,
  MUTACION_PRESENTAR_PLANILLA,
  type GuardarPlanillaEntrada,
  type ObraDePlanilla,
  type Planilla,
} from './planillas.graphql';

/** Fotos por página al buscar las del periodo (el máximo que acepta Obras). */
export const TAMANO_PAGINA_FOTOS_PERIODO = 100;

/** Datos de las planillas (007): los componentes no usan Apollo directo (docs/estructura.md). */
@Injectable()
export class PlanillasService {
  private readonly apollo = inject(Apollo);

  /** La planilla con sus líneas, totales y versión; null si no existe sin error. */
  obtener(id: string): Observable<Planilla | null> {
    return this.apollo
      .query({ query: CONSULTA_PLANILLA, variables: { id }, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.planilla ?? null));
  }

  /**
   * Nombre, estado, inicio y residente de la obra. Admite respuesta parcial (errorPolicy «all»), como el detalle:
   * si falla el nombre de una asignación, la obra llega igual.
   */
  obra(id: string): Observable<ObraDePlanilla | null> {
    return this.apollo
      .query({ query: CONSULTA_OBRA_DE_PLANILLA, variables: { id }, fetchPolicy: 'network-only', errorPolicy: 'all' })
      .pipe(
        map((resultado) => {
          const obra = resultado.data?.obra ?? null;
          if (!obra && resultado.error) throw resultado.error;
          return obra;
        }),
      );
  }

  /** Crea la planilla del periodo `AAAA-MM` en BORRADOR, con una línea por partida en 0 (criterio 1). */
  crear(obraId: string, periodo: string): Observable<Planilla> {
    return this.apollo
      .mutate({ mutation: MUTACION_CREAR_PLANILLA, variables: { obraId, periodo } })
      .pipe(map((resultado) => resultado.data!.crearPlanilla));
  }

  /** Guarda el borrador con la versión que se leyó (bloqueo optimista, criterio 7). */
  guardar(id: string, entrada: GuardarPlanillaEntrada): Observable<Planilla> {
    return this.apollo
      .mutate({ mutation: MUTACION_GUARDAR_PLANILLA, variables: { id, entrada } })
      .pipe(map((resultado) => resultado.data!.guardarPlanilla));
  }

  presentar(id: string, version: number): Observable<Planilla> {
    return this.apollo
      .mutate({ mutation: MUTACION_PRESENTAR_PLANILLA, variables: { id, version } })
      .pipe(map((resultado) => resultado.data!.presentarPlanilla));
  }

  /**
   * Fotos de avance de la obra registradas dentro del periodo (mes en La Paz), para adjuntarlas (criterio 6). Obras
   * las devuelve de la más reciente a la más antigua y sin filtro de fecha: se piden páginas hasta pasar el inicio
   * del periodo o terminar.
   */
  fotosDelPeriodo(obraId: string, periodo: string): Observable<Foto[]> {
    const pedir = (pagina: number): Observable<FotosPagina> =>
      this.apollo
        .query({
          query: CONSULTA_FOTOS,
          variables: { id: obraId, pagina, tamano: TAMANO_PAGINA_FOTOS_PERIODO },
          fetchPolicy: 'network-only',
        })
        .pipe(
          map(
            (resultado) =>
              resultado.data?.obra?.fotos ?? { items: [], total: 0, pagina, tamano: TAMANO_PAGINA_FOTOS_PERIODO },
          ),
        );
    return pedir(1).pipe(
      expand((pagina) => {
        const ultima = pagina.items.at(-1);
        const hayMas = pagina.items.length > 0 && pagina.pagina * pagina.tamano < pagina.total;
        return hayMas && ultima && periodoDe(ultima.registradoEn) >= periodo ? pedir(pagina.pagina + 1) : EMPTY;
      }),
      reduce((fotos, pagina) => [...fotos, ...pagina.items], [] as Foto[]),
      map((fotos) => {
        const vistas = new Set<string>();
        return fotos.filter((foto) => {
          if (vistas.has(foto.id) || periodoDe(foto.registradoEn) !== periodo) return false;
          vistas.add(foto.id);
          return true;
        });
      }),
    );
  }
}
