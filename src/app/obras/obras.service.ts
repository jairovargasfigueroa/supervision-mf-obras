import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, type Observable } from 'rxjs';
import { CONSULTA_OBRAS, type ObraResumen } from './obras.graphql';

/** Datos del área de obras: los componentes no usan Apollo directo (docs/estructura.md). */
@Injectable()
export class ObrasService {
  private readonly apollo = inject(Apollo);

  listar(): Observable<ObraResumen[]> {
    return this.apollo
      .query({ query: CONSULTA_OBRAS, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.obras ?? []));
  }
}
