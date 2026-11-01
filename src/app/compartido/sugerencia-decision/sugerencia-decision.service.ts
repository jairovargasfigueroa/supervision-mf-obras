import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Apollo } from 'apollo-angular';
import { map, type Observable } from 'rxjs';
import {
  MUTACION_APROBAR_SUGERENCIA,
  MUTACION_RECHAZAR_SUGERENCIA,
  type Sugerencia,
} from './sugerencia-decision.graphql';
import {
  SugerenciaDecisionComponent,
  type DatosDecision,
  type ModoDecision,
  type ResultadoDecision,
} from './sugerencia-decision.component';

/**
 * Decisión sobre una sugerencia de un agente (502, criterios 12 a 14): abre el diálogo de aprobar o rechazar y envía
 * la mutación. Se provee en las rutas (como ObrasService) porque usa el Apollo de este microfrontend.
 */
@Injectable()
export class SugerenciaDecisionService {
  private readonly apollo = inject(Apollo);
  private readonly dialogos = inject(MatDialog);

  /** Aprueba con el comentario, que va solo si se escribió. */
  aprobar(id: string, comentario: string | null): Observable<Sugerencia> {
    return this.apollo
      .mutate({
        mutation: MUTACION_APROBAR_SUGERENCIA,
        variables: comentario ? { id, comentario } : { id },
      })
      .pipe(map((resultado) => resultado.data!.aprobarSugerencia));
  }

  rechazar(id: string, motivo: string): Observable<Sugerencia> {
    return this.apollo
      .mutate({ mutation: MUTACION_RECHAZAR_SUGERENCIA, variables: { id, motivo } })
      .pipe(map((resultado) => resultado.data!.rechazarSugerencia));
  }

  /** Abre el diálogo; emite cómo se cerró (decidida, aviso o cancelada). */
  decidir(sugerencia: Sugerencia, modo: ModoDecision): Observable<ResultadoDecision> {
    const datos: DatosDecision = {
      modo,
      sugerencia,
      enviar: (texto) =>
        modo === 'aprobar'
          ? this.aprobar(sugerencia.id, texto)
          : this.rechazar(sugerencia.id, texto ?? ''),
    };
    return this.dialogos
      .open<SugerenciaDecisionComponent, DatosDecision, ResultadoDecision>(
        SugerenciaDecisionComponent,
        {
          data: datos,
          autoFocus: 'textarea',
        },
      )
      .afterClosed();
  }
}
