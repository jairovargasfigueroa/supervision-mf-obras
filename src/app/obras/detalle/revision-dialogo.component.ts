import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  ReactiveFormsModule,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { Observable } from 'rxjs';
import { leerError, mensajeDeError, registrarError } from '../../nucleo/errores';
import type { ConsumoAtipico } from '../obras.graphql';

/** Largo del comentario de una revisión (403, criterio 7). */
export const COMENTARIO_MINIMO = 5;
export const COMENTARIO_MAXIMO = 300;

export type DecisionRevision = 'NORMAL' | 'CONFIRMADO';

export interface DatosRevisionDialogo {
  estado: DecisionRevision;
  /** Envía la revisión con el comentario (sin espacios de más; null si no se escribió). */
  enviar: (comentario: string | null) => Observable<ConsumoAtipico>;
}

/**
 * Cómo se cerró el diálogo: `revisado` (se guardó), `aviso` (el consumo ya fue revisado o ya no existe: la sección
 * muestra el mensaje y recarga la lista) o `undefined` (Cancelar).
 */
export type ResultadoRevision = { tipo: 'revisado' } | { tipo: 'aviso'; mensaje: string } | undefined;

/** Comentario de 5 a 300 caracteres sin contar espacios de los bordes; obligatorio al confirmar (criterio 7). */
export function validarComentario(estado: DecisionRevision) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const largo = (control.value ?? '').trim().length;
    if (largo === 0) return estado === 'CONFIRMADO' ? { required: true } : null;
    return largo < COMENTARIO_MINIMO || largo > COMENTARIO_MAXIMO ? { largo: true } : null;
  };
}

/** Códigos que cierran el diálogo con su aviso y recargan la lista (docs/mensajes.md, 403). */
const CIERRAN_CON_AVISO = ['REVISION_YA_REGISTRADA', 'CONSUMO_ATIPICO_NO_ENCONTRADO'];

/**
 * Diálogo de «Es normal» y «Confirmar problema» (403, criterios 7 y 8): comentario con contador (obligatorio al
 * confirmar, opcional en «Es normal»; de 5 a 300 caracteres). Envía la revisión y muestra aquí los errores que se
 * pueden corregir (COMENTARIO_INVALIDO con la regla junto al campo).
 */
@Component({
  selector: 'app-revision-dialogo',
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ titulo }}</h2>
    <mat-dialog-content>
      @if (error(); as error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      <mat-form-field class="comentario">
        <mat-label>Comentario</mat-label>
        <textarea
          matInput
          [formControl]="comentario"
          [maxlength]="maximo"
          rows="4"
          [required]="obligatorio"
        ></textarea>
        <mat-hint>{{ ayuda }}</mat-hint>
        <mat-hint align="end">{{ largo() }} / {{ maximo }}</mat-hint>
        @if (comentario.invalid) {
          <mat-error>{{ mensajeCampo() }}</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined" [disabled]="enviando()">
        Cancelar
      </button>
      <button mat-flat-button type="button" (click)="enviar()" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : titulo }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .comentario {
      width: min(480px, 100%);
    }
    .error {
      margin: 0 0 12px;
      color: var(--sv-error);
    }
  `,
})
export class RevisionDialogoComponent {
  private readonly datos = inject<DatosRevisionDialogo>(MAT_DIALOG_DATA);
  private readonly dialogo = inject<MatDialogRef<RevisionDialogoComponent, ResultadoRevision>>(MatDialogRef);

  protected readonly obligatorio = this.datos.estado === 'CONFIRMADO';
  protected readonly titulo = this.obligatorio ? 'Confirmar problema' : 'Es normal';
  protected readonly ayuda = this.obligatorio
    ? `Obligatorio, de ${COMENTARIO_MINIMO} a ${COMENTARIO_MAXIMO} caracteres`
    : `Opcional, de ${COMENTARIO_MINIMO} a ${COMENTARIO_MAXIMO} caracteres`;
  protected readonly maximo = COMENTARIO_MAXIMO;

  protected readonly comentario = new FormControl('', {
    nonNullable: true,
    validators: validarComentario(this.datos.estado),
  });
  private readonly valor = toSignal(this.comentario.valueChanges, { initialValue: '' });
  protected readonly largo = () => this.valor().length;

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Regla que devolvió el servicio para el campo (COMENTARIO_INVALIDO, `errores[].mensaje`). */
  private readonly reglaServidor = signal<string | null>(null);

  protected mensajeCampo(): string {
    const errores = this.comentario.errors ?? {};
    if (errores['servidor']) return this.reglaServidor() ?? '';
    if (errores['required']) return 'Obligatorio';
    return `Debe tener entre ${COMENTARIO_MINIMO} y ${COMENTARIO_MAXIMO} caracteres`;
  }

  enviar(): void {
    this.comentario.markAsTouched();
    if (this.comentario.invalid) return;
    const texto = this.comentario.value.trim();
    this.enviando.set(true);
    this.error.set(null);
    this.datos.enviar(texto || null).subscribe({
      next: () => this.dialogo.close({ tipo: 'revisado' }),
      error: (error: unknown) => {
        const leido = leerError(error);
        registrarError('revisarConsumoAtipico', leido);
        this.enviando.set(false);
        if (leido.codigo && CIERRAN_CON_AVISO.includes(leido.codigo)) {
          this.dialogo.close({ tipo: 'aviso', mensaje: mensajeDeError(leido) });
          return;
        }
        this.error.set(mensajeDeError(leido));
        const regla = leido.errores.find((e) => e.campo === 'comentario');
        if (regla) {
          this.reglaServidor.set(regla.mensaje);
          this.comentario.setErrors({ servidor: true });
        }
      },
    });
  }
}
