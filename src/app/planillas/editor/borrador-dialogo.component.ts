import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export type DecisionBorrador = 'aplicar' | 'descartar';

export interface DatosBorradorDialogo {
  /** CONFLICTO: la planilla cambió en el servidor; NO_EDITABLE: ya no se puede editar (104, criterios 14 y 15). */
  tipo: 'CONFLICTO' | 'NO_EDITABLE';
  /** NO_EDITABLE: «La planilla ya no se puede editar (estado X)». */
  mensaje?: string;
}

/**
 * Decisión sobre un borrador local que no se pudo enviar: con CONFLICTO, «Aplicar mi borrador sobre la última
 * versión» o «Descartar mi borrador»; con NO_EDITABLE, solo «Descartar mi borrador». Se cierra con la decisión.
 */
@Component({
  selector: 'app-borrador-dialogo',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (datos.tipo === 'CONFLICTO') {
      <h2 mat-dialog-title>La planilla cambió en el servidor</h2>
      <mat-dialog-actions align="end">
        <button mat-button [mat-dialog-close]="'descartar'">Descartar mi borrador</button>
        <button mat-flat-button [mat-dialog-close]="'aplicar'">
          Aplicar mi borrador sobre la última versión
        </button>
      </mat-dialog-actions>
    } @else {
      <h2 mat-dialog-title>{{ datos.mensaje }}</h2>
      <mat-dialog-actions align="end">
        <button mat-flat-button [mat-dialog-close]="'descartar'">Descartar mi borrador</button>
      </mat-dialog-actions>
    }
  `,
})
export class BorradorDialogoComponent {
  protected readonly datos = inject<DatosBorradorDialogo>(MAT_DIALOG_DATA);
}
