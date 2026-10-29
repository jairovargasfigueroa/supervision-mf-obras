import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, type Observable } from 'rxjs';
import {
  CONSULTA_OBRA,
  CONSULTA_OBRAS,
  CONSULTA_USUARIOS,
  MUTACION_REGISTRAR_OBRA,
  type EstadoObra,
  type FiltrosObras,
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

  /** Detalle de la obra; null si no existe o el usuario no la ve (OBRA_NO_ENCONTRADA llega como error). */
  obtener(id: string): Observable<Obra | null> {
    return this.apollo
      .query({ query: CONSULTA_OBRA, variables: { id }, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.obra ?? null));
  }

  registrar(entrada: RegistrarObraEntrada): Observable<{ id: string; estado: EstadoObra }> {
    return this.apollo
      .mutate({ mutation: MUTACION_REGISTRAR_OBRA, variables: { entrada } })
      .pipe(map((resultado) => resultado.data!.registrarObra));
  }
}
