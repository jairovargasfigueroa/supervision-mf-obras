import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
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
import { formatearMonto } from '../../nucleo/formato';
import { fechaDe } from '../../nucleo/periodos';
import type { Cobro } from '../obras.graphql';

/** Largo máximo del n.º de comprobante (201, criterio 2). */
export const COMPROBANTE_MAXIMO = 50;

export const FECHA_PAGO_FUERA_DE_RANGO =
  'La fecha de pago no puede ser futura ni anterior a la emisión del cobro.';

export interface DatosPagoDialogo {
  cobro: Pick<Cobro, 'numero' | 'montoNeto' | 'emitidoEn'>;
  /** Fecha de hoy en La Paz (`AAAA-MM-DD`): valor por defecto y máximo de la fecha de pago. */
  hoy: string;
  /** Registra el pago con la fecha (`AAAA-MM-DD`) y el comprobante (sin espacios de más; null si no se escribió). */
  enviar: (pagadoEn: string, comprobante: string | null) => Observable<Cobro>;
}

/**
 * Cómo se cerró el diálogo: `pagado` (se registró), `aviso` (el cobro ya estaba pagado o ya no existe: la pestaña
 * muestra el mensaje y se recarga) o `undefined` (Cancelar).
 */
export type ResultadoPago = { tipo: 'pagado' } | { tipo: 'aviso'; mensaje: string } | undefined;

/** Fecha de pago obligatoria, entre `minimo` (emisión) y `maximo` (hoy), ambos incluidos (201, criterio 2). */
export function validarFechaPago(minimo: string, maximo: string) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const fecha = control.value ?? '';
    if (!fecha) return { required: true };
    return fecha < minimo || fecha > maximo ? { rango: true } : null;
  };
}

/** Comprobante opcional, hasta 50 caracteres sin contar los espacios de los bordes. */
export function validarComprobante(control: AbstractControl<string>): ValidationErrors | null {
  return (control.value ?? '').trim().length > COMPROBANTE_MAXIMO ? { largo: true } : null;
}

/** Códigos que cierran el diálogo con su aviso y recargan la pestaña (docs/mensajes.md, 201). */
const CIERRAN_CON_AVISO = ['COBRO_YA_PAGADO', 'COBRO_NO_ENCONTRADO'];

/**
 * Diálogo «Registrar pago» (201, criterios 2 a 4): fecha de pago (por defecto hoy en La Paz, entre la emisión del
 * cobro y hoy) y n.º de comprobante opcional. Se paga el cobro completo. Los errores que se pueden corregir
 * (FECHA_PAGO_INVALIDA, DATOS_INVALIDOS) se muestran aquí.
 */
@Component({
  selector: 'app-pago-dialogo',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Registrar pago</h2>
    <mat-dialog-content>
      <p class="cobro">Cobro {{ numero }} · {{ monto }}</p>
      @if (error(); as error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      <form [formGroup]="formulario" (ngSubmit)="enviar()" id="formulario-pago">
        <mat-form-field class="campo">
          <mat-label>Fecha de pago</mat-label>
          <input
            matInput
            type="date"
            formControlName="pagadoEn"
            [attr.min]="minimo"
            [attr.max]="hoy"
            required
          />
          @if (formulario.controls.pagadoEn.invalid) {
            <mat-error>{{ mensajeFecha() }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="campo">
          <mat-label>N.º de comprobante (opcional)</mat-label>
          <input matInput formControlName="comprobante" [maxlength]="maximo" />
          <mat-hint align="end">{{ largo() }} / {{ maximo }}</mat-hint>
          @if (formulario.controls.comprobante.invalid) {
            <mat-error>Hasta {{ maximo }} caracteres</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined" [disabled]="enviando()">
        Cancelar
      </button>
      <button mat-flat-button type="submit" form="formulario-pago" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Registrar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .campo {
      width: min(360px, 100%);
    }
    .cobro {
      margin: 0 0 12px;
      color: var(--sv-texto-secundario);
    }
    .error {
      margin: 0 0 12px;
      color: var(--sv-error);
    }
  `,
})
export class PagoDialogoComponent {
  private readonly datos = inject<DatosPagoDialogo>(MAT_DIALOG_DATA);
  private readonly dialogo =
    inject<MatDialogRef<PagoDialogoComponent, ResultadoPago>>(MatDialogRef);

  protected readonly numero = this.datos.cobro.numero;
  protected readonly monto = formatearMonto(this.datos.cobro.montoNeto);
  /** Fecha de emisión del cobro en La Paz. */
  protected readonly minimo = fechaDe(this.datos.cobro.emitidoEn);
  protected readonly hoy = this.datos.hoy;
  protected readonly maximo = COMPROBANTE_MAXIMO;

  protected readonly formulario = new FormGroup({
    pagadoEn: new FormControl(this.hoy, {
      nonNullable: true,
      validators: validarFechaPago(this.minimo, this.hoy),
    }),
    comprobante: new FormControl('', { nonNullable: true, validators: validarComprobante }),
  });
  private readonly comprobante = toSignal(this.formulario.controls.comprobante.valueChanges, {
    initialValue: '',
  });
  protected readonly largo = () => this.comprobante().length;

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected mensajeFecha(): string {
    return this.formulario.controls.pagadoEn.errors?.['required']
      ? 'Obligatorio'
      : FECHA_PAGO_FUERA_DE_RANGO;
  }

  enviar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando()) return;
    const { pagadoEn, comprobante } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.datos.enviar(pagadoEn, comprobante.trim() || null).subscribe({
      next: () => this.dialogo.close({ tipo: 'pagado' }),
      error: (error: unknown) => {
        const leido = leerError(error);
        registrarError('registrarPagoCobro', leido);
        this.enviando.set(false);
        if (leido.codigo && CIERRAN_CON_AVISO.includes(leido.codigo)) {
          this.dialogo.close({ tipo: 'aviso', mensaje: mensajeDeError(leido) });
          return;
        }
        this.error.set(mensajeDeError(leido));
        if (leido.codigo === 'FECHA_PAGO_INVALIDA') {
          this.formulario.controls.pagadoEn.setErrors({ rango: true });
        }
      },
    });
  }
}
