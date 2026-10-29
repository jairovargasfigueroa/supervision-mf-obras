import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, type Observable } from 'rxjs';
import {
  CONSULTA_FINANZAS_OBRA,
  CONSULTA_OBRA,
  CONSULTA_OBRAS,
  CONSULTA_USUARIOS,
  MUTACION_REGISTRAR_OBRA,
  type EstadoObra,
  type FiltrosObras,
  type FinanzasObra,
  type Obra,
  type ObraResumen,
  type RegistrarObraEntrada,
  type Rol,
  type Usuario,
} from './obras.graphql';

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

  registrar(entrada: RegistrarObraEntrada): Observable<{ id: string; estado: EstadoObra }> {
    return this.apollo
      .mutate({ mutation: MUTACION_REGISTRAR_OBRA, variables: { entrada } })
      .pipe(map((resultado) => resultado.data!.registrarObra));
  }
}
