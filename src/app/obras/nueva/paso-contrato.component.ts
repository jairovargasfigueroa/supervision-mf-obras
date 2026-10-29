import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { mensajeCampo, revisarAlCambiarEstado, type FormContrato } from './formulario';

/** Paso 2: contrato (criterio 3). */
@Component({
  selector: 'app-paso-contrato',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="campos" [formGroup]="grupo()">
      <mat-form-field>
        <mat-label>Monto del contrato (Bs)</mat-label>
        <input matInput type="number" class="sv-numero" formControlName="monto" min="0" step="0.01" required />
        @if (grupo().controls.monto.invalid) {
          <mat-error>{{ mensaje(grupo().controls.monto) }}</mat-error>
        }
      </mat-form-field>

      <mat-form-field>
        <mat-label>Plazo (días)</mat-label>
        <input matInput type="number" class="sv-numero" formControlName="plazoDias" min="1" step="1" required />
        @if (grupo().controls.plazoDias.invalid) {
          <mat-error>{{ mensaje(grupo().controls.plazoDias) }}</mat-error>
        }
      </mat-form-field>

      <mat-form-field>
        <mat-label>Anticipo (%)</mat-label>
        <input matInput type="number" class="sv-numero" formControlName="anticipoPct" min="0" max="100" required />
        @if (grupo().controls.anticipoPct.invalid) {
          <mat-error>{{ mensaje(grupo().controls.anticipoPct) }}</mat-error>
        }
      </mat-form-field>

      <mat-form-field>
        <mat-label>Retención (%)</mat-label>
        <input matInput type="number" class="sv-numero" formControlName="retencionPct" min="0" max="100" required />
        @if (grupo().controls.retencionPct.invalid) {
          <mat-error>{{ mensaje(grupo().controls.retencionPct) }}</mat-error>
        }
      </mat-form-field>

      <mat-form-field>
        <mat-label>Fecha de firma</mat-label>
        <input matInput type="date" formControlName="firmadoEn" required />
        @if (grupo().controls.firmadoEn.invalid) {
          <mat-error>{{ mensaje(grupo().controls.firmadoEn) }}</mat-error>
        }
      </mat-form-field>
    </div>
    @if (grupo().errors?.['porcentajes'] && (grupo().touched || grupo().dirty)) {
      <div class="aviso aviso-error" role="alert">El anticipo más la retención deben sumar menos de 100 %</div>
    }
  `,
  styleUrl: './pasos.scss',
})
export class PasoContratoComponent {
  readonly grupo = input.required<FormContrato>();
  protected readonly mensaje = mensajeCampo;

  constructor() {
    revisarAlCambiarEstado(() => this.grupo());
  }
}
