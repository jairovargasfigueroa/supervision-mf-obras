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
import type { Sugerencia } from './sugerencia-decision.graphql';

/** Largos de la decisión (502, criterios 12 y 13). */
export const COMENTARIO_MAXIMO = 300;
export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 500;

/** Reglas locales de la decisión (docs/mensajes.md: `MOTIVO_INVALIDO` y la del comentario). */
export const MENSAJE_MOTIVO = `El motivo debe tener entre ${MOTIVO_MINIMO} y ${MOTIVO_MAXIMO} caracteres.`;
export const MENSAJE_COMENTARIO = `El comentario puede tener hasta ${COMENTARIO_MAXIMO} caracteres.`;

export type ModoDecision = 'aprobar' | 'rechazar';

export interface DatosDecision {
  modo: ModoDecision;
  sugerencia: Sugerencia;
  /** Envía la decisión con el texto (sin espacios de los bordes; null si no se escribió). */
  enviar: (texto: string | null) => Observable<Sugerencia>;
}

/**
 * Cómo se cerró el diálogo: `decidida`, `aviso` (otra persona ya la decidió o ya no se puede ver: la lista muestra
 * el mensaje y se recarga) o `undefined` (Cancelar).
 */
export type ResultadoDecision =
  { tipo: 'decidida' } | { tipo: 'aviso'; mensaje: string } | undefined;

/** Comentario opcional de hasta 300; motivo obligatorio de 10 a 500 (sin contar los espacios de los bordes). */
export function validarTextoDecision(modo: ModoDecision) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const largo = (control.value ?? '').trim().length;
    if (modo === 'aprobar') return largo > COMENTARIO_MAXIMO ? { largo: true } : null;
    if (largo === 0) return { required: true };
    return largo < MOTIVO_MINIMO || largo > MOTIVO_MAXIMO ? { largo: true } : null;
  };
}

/** Códigos que cierran el diálogo con su aviso y recargan la lista (docs/mensajes.md, 502). */
const CIERRAN_CON_AVISO = ['SUGERENCIA_YA_DECIDIDA', 'SUGERENCIA_NO_ENCONTRADA'];

/**
 * Diálogos de «Aprobar» (comentario opcional) y «Rechazar» (motivo obligatorio con contador) de una sugerencia
 * (502, criterios 12 a 14). Aprobar solo registra la decisión: no se crea, modifica ni envía nada en otro servicio.
 */
@Component({
  selector: 'app-sugerencia-decision',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ titulo }}</h2>
    <mat-dialog-content>
      <p class="accion">{{ datos.sugerencia.accionTexto }}</p>
      <p class="descripcion">{{ datos.sugerencia.descripcion }}</p>
      <p class="ayuda">{{ ayudaDecision }}</p>
      @if (error(); as error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      <mat-form-field class="texto">
        <mat-label>{{ etiqueta }}</mat-label>
        <textarea
          matInput
          [formControl]="texto"
          [maxlength]="maximo"
          rows="4"
          [required]="rechazo"
        ></textarea>
        <mat-hint>{{ ayudaCampo }}</mat-hint>
        <mat-hint align="end">{{ largo() }} / {{ maximo }}</mat-hint>
        @if (texto.invalid) {
          <mat-error>{{ mensajeCampo() }}</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined" [disabled]="enviando()">
        Cancelar
      </button>
      <button mat-flat-button type="button" (click)="enviar()" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : boton }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .texto {
      width: min(480px, 100%);
    }
    .accion {
      margin: 0 0 4px;
      font-weight: 600;
    }
    .descripcion,
    .ayuda {
      margin: 0 0 12px;
      color: var(--sv-texto-secundario);
    }
    .error {
      margin: 0 0 12px;
      color: var(--sv-error);
    }
  `,
})
export class SugerenciaDecisionComponent {
  protected readonly datos = inject<DatosDecision>(MAT_DIALOG_DATA);
  private readonly dialogo =
    inject<MatDialogRef<SugerenciaDecisionComponent, ResultadoDecision>>(MatDialogRef);

  protected readonly rechazo = this.datos.modo === 'rechazar';
  protected readonly titulo = this.rechazo ? 'Rechazar sugerencia' : 'Aprobar sugerencia';
  protected readonly boton = this.rechazo ? 'Rechazar' : 'Aprobar';
  protected readonly etiqueta = this.rechazo ? 'Motivo' : 'Comentario (opcional)';
  protected readonly maximo = this.rechazo ? MOTIVO_MAXIMO : COMENTARIO_MAXIMO;
  protected readonly ayudaCampo = this.rechazo
    ? `Obligatorio, de ${MOTIVO_MINIMO} a ${MOTIVO_MAXIMO} caracteres`
    : `Opcional, hasta ${COMENTARIO_MAXIMO} caracteres`;
  protected readonly ayudaDecision = this.rechazo
    ? 'Escribe por qué no corresponde esta sugerencia.'
    : 'Aprobar solo registra tu decisión: no se crea ni se envía nada en otra área.';

  protected readonly texto = new FormControl('', {
    nonNullable: true,
    validators: validarTextoDecision(this.datos.modo),
  });
  private readonly valor = toSignal(this.texto.valueChanges, { initialValue: '' });
  protected readonly largo = () => this.valor().length;

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Regla que devolvió el servicio para el campo (`errores[].mensaje`). */
  private readonly reglaServidor = signal<string | null>(null);

  protected mensajeCampo(): string {
    const errores = this.texto.errors ?? {};
    if (errores['servidor']) return this.reglaServidor() ?? '';
    return this.rechazo ? MENSAJE_MOTIVO : MENSAJE_COMENTARIO;
  }

  enviar(): void {
    this.texto.markAsTouched();
    if (this.texto.invalid) return;
    const texto = this.texto.value.trim();
    this.enviando.set(true);
    this.error.set(null);
    this.datos.enviar(texto || null).subscribe({
      next: () => this.dialogo.close({ tipo: 'decidida' }),
      error: (error: unknown) => {
        const leido = leerError(error);
        registrarError(this.rechazo ? 'rechazarSugerencia' : 'aprobarSugerencia', leido);
        this.enviando.set(false);
        if (leido.codigo && CIERRAN_CON_AVISO.includes(leido.codigo)) {
          this.dialogo.close({ tipo: 'aviso', mensaje: mensajeDeError(leido) });
          return;
        }
        this.error.set(mensajeDeError(leido));
        const regla = leido.errores.find(
          (e) => e.campo === (this.rechazo ? 'motivo' : 'comentario'),
        );
        if (regla) {
          this.reglaServidor.set(regla.mensaje);
          this.texto.setErrors({ servidor: true });
        }
      },
    });
  }
}
