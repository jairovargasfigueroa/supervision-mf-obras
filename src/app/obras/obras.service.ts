import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, type Observable } from 'rxjs';
import {
  CONSULTA_COBROS,
  CONSULTA_FINANZAS_OBRA,
  CONSULTA_FOTOS,
  CONSULTA_MATERIAL_COMPARADO,
  CONSULTA_OBRA,
  CONSULTA_OBRAS,
  CONSULTA_PLANILLAS,
  CONSULTA_USUARIOS,
  MUTACION_REGISTRAR_OBRA,
  type Cobro,
  type ComparacionMaterial,
  type EstadoObra,
  type FiltrosObras,
  type FinanzasObra,
  type FotosPagina,
  type Obra,
  type ObraResumen,
  type PlanillaResumen,
  type RegistrarObraEntrada,
  type Rol,
  type Usuario,
} from './obras.graphql';

/** Fotos por página (el valor por defecto de `fotos` en el contrato; Obras acepta hasta 100). */
export const TAMANO_PAGINA_FOTOS = 50;

/** Datos del área de obras: los componentes no usan Apollo directo (docs/estructura.md). */
@Injectable()
export class ObrasService {
  private readonly apollo = inject(Apollo);

  /** Obras que el usuario puede ver; el gateway filtra por estado y busca por nombre (006, criterio 2). */
  listar(filtros: FiltrosObras = {}): Observable<ObraResumen[]> {
    return this.apollo
      .query({ query: CONSULTA_OBRAS, variables: filtros, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.obras ?? []));
  }

  /** Usuarios de Keycloak con un rol (para las asignaciones de la obra). */
  usuarios(rol: Rol): Observable<Usuario[]> {
    return this.apollo
      .query({ query: CONSULTA_USUARIOS, variables: { rol }, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.usuarios ?? []));
  }

  /**
   * Encabezado, indicadores y partidas de la obra. Admite respuesta parcial (errorPolicy «all»): si un campo
   * secundario falla (por ejemplo los nombres de las asignaciones), la obra se muestra igual. Solo es error si no
   * llega la obra (OBRA_NO_ENCONTRADA, gateway caído); null si no existe sin error.
   */
  obtener(id: string): Observable<Obra | null> {
    return this.apollo
      .query({ query: CONSULTA_OBRA, variables: { id }, fetchPolicy: 'network-only', errorPolicy: 'all' })
      .pipe(
        map((resultado) => {
          const obra = resultado.data?.obra ?? null;
          if (!obra && resultado.error) throw resultado.error;
          return obra;
        }),
      );
  }

  /** Saldo disponible y total cobrado (Finanzas); null sin error si el rol no es admin ni gerente. */
  finanzas(id: string): Observable<FinanzasObra | null> {
    return this.apollo
      .query({ query: CONSULTA_FINANZAS_OBRA, variables: { id }, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.obra?.finanzas ?? null));
  }

  /** Material usado frente al previsto del periodo `AAAA-MM`; null si el gateway no lo devuelve. */
  materialComparado(id: string, periodo: string): Observable<ComparacionMaterial | null> {
    return this.apollo
      .query({ query: CONSULTA_MATERIAL_COMPARADO, variables: { id, periodo }, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.obra?.materialComparado ?? null));
  }

  /** Una página de fotos de avance, de la más reciente a la más antigua (orden de Obras). */
  fotos(id: string, pagina: number, tamano = TAMANO_PAGINA_FOTOS): Observable<FotosPagina> {
    return this.apollo
      .query({ query: CONSULTA_FOTOS, variables: { id, pagina, tamano }, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.obra?.fotos ?? { items: [], total: 0, pagina, tamano }));
  }

  planillas(id: string): Observable<PlanillaResumen[]> {
    return this.apollo
      .query({ query: CONSULTA_PLANILLAS, variables: { id }, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.obra?.planillas ?? []));
  }

  /** Cobros de la obra (Finanzas); null sin error si el rol no es admin ni gerente. */
  cobros(id: string): Observable<Cobro[] | null> {
    return this.apollo
      .query({ query: CONSULTA_COBROS, variables: { id }, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.obra?.cobros ?? null));
  }

  registrar(entrada: RegistrarObraEntrada): Observable<{ id: string; estado: EstadoObra }> {
    return this.apollo
      .mutate({ mutation: MUTACION_REGISTRAR_OBRA, variables: { entrada } })
      .pipe(map((resultado) => resultado.data!.registrarObra));
  }
}
