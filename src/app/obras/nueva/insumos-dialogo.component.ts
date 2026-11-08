import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { mensajeDeError } from '../../nucleo/errores';
import type { MaterialCatalogo } from '../obras.graphql';
import {
  crearInsumo,
  insumosSinRepetir,
  mensajeCampo,
  revisarAlCambiarEstado,
  type FormInsumo,
  type ValorInsumo,
} from './formulario';

export interface DatosInsumosDialogo {
  partida: { codigo: string; nombre: string; unidad: string };
  /** Materiales activos del catálogo (003). */
  materiales: readonly MaterialCatalogo[];
  /** Insumos que ya tiene la partida. */
  insumos: readonly ValorInsumo[];
}

/**
 * Insumos previstos de una partida (002, criterio 4): material del catálogo (solo activos) y cantidad por unidad de la
 * partida (mayor a 0), sin repetir el material. Trabaja sobre una copia: «Aceptar» devuelve la lista nueva y
 * «Cancelar» no cambia nada.
 */
@Component({
  selector: 'app-insumos-dialogo',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Insumos previstos · {{ datos.partida.codigo || 'Partida' }}</h2>
    <mat-dialog-content>
      <p class="ayuda">
        Material que se prevé gastar por cada {{ unidad }} de «{{ datos.partida.nombre || 'la partida' }}». Es
        opcional: una partida puede no tener insumos.
      </p>
      @if (!datos.materiales.length) {
        <div class="aviso aviso-error" role="alert">No hay materiales activos en el catálogo.</div>
      }
      @for (fila of filas(); track fila; let i = $index) {
        <div class="fila">
          <mat-form-field class="material">
            <mat-label>Material</mat-label>
            <mat-select [formControl]="fila.controls.materialId" required>
              @for (material of datos.materiales; track material.id) {
                <mat-option [value]="material.id">{{ material.codigo }} · {{ material.nombre }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ mensaje(fila.controls.materialId) }}</mat-error>
          </mat-form-field>
          <mat-form-field class="cantidad">
            <mat-label>Cantidad por {{ unidad }}</mat-label>
            <input
              matInput
              type="number"
              class="sv-numero"
              min="0"
              step="0.001"
              required
              [formControl]="fila.controls.cantidadPorUnidad"
            />
            @if (material(fila.controls.materialId.value); as elegido) {
              <span matTextSuffix>{{ elegido.unidadPlural }}</span>
            }
            <mat-error>{{ mensaje(fila.controls.cantidadPorUnidad) }}</mat-error>
          </mat-form-field>
          <button mat-icon-button type="button" aria-label="Quitar insumo" (click)="quitar(i)">
            <mat-icon fontSet="material-symbols-outlined">delete</mat-icon>
          </button>
        </div>
      }
      @if (insumos.hasError('insumoRepetido')) {
        <div class="aviso aviso-error" role="alert">{{ mensajeRepetido }}</div>
      }
      <button mat-stroked-button type="button" (click)="agregar()" [disabled]="!datos.materiales.length">
        <mat-icon fontSet="material-symbols-outlined">add</mat-icon>
        Insumo
      </button>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancelar</button>
      <button mat-flat-button type="button" (click)="aceptar()">Aceptar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .ayuda {
      margin: 0 0 12px;
      color: var(--sv-texto-secundario);
    }
    .fila {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .material {
      flex: 2 1 240px;
    }
    .cantidad {
      flex: 1 1 160px;
    }
    .fila button {
      margin-top: 8px;
    }
    .aviso {
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: var(--sv-radio-control);
    }
    .aviso-error {
      color: var(--sv-error);
      background: var(--sv-error-suave);
    }
    @media (max-width: 599px) {
      .fila {
        flex-wrap: wrap;
      }
    }
  `,
})
export class InsumosDialogoComponent {
  protected readonly datos = inject<DatosInsumosDialogo>(MAT_DIALOG_DATA);
  private readonly referencia = inject<MatDialogRef<InsumosDialogoComponent, ValorInsumo[]>>(MatDialogRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly insumos = this.fb.array<FormInsumo>(
    this.datos.insumos.map((valor) => crearInsumo(this.fb, valor)),
    { validators: insumosSinRepetir },
  );
  /** Copia de los controles para volver a pintar al agregar o quitar filas. */
  private readonly version = signal(0);
  protected readonly filas = computed(() => {
    this.version();
    return [...this.insumos.controls];
  });

  protected readonly unidad = this.datos.partida.unidad.trim() || 'unidad';
  protected readonly mensaje = mensajeCampo;
  /** Texto de INSUMO_REPETIDO (docs/mensajes.md). */
  protected readonly mensajeRepetido = mensajeDeError(
    { codigo: 'INSUMO_REPETIDO', estado: 422, servicio: null, errores: [], red: false },
    { codigo: this.datos.partida.codigo.trim() },
  );

  constructor() {
    revisarAlCambiarEstado(() => this.insumos);
  }

  agregar(): void {
    this.insumos.push(crearInsumo(this.fb));
    this.version.update((v) => v + 1);
  }

  quitar(indice: number): void {
    this.insumos.removeAt(indice);
    this.version.update((v) => v + 1);
  }

  /** «Aceptar»: con datos incompletos o un material repetido no se cierra y se ven los errores. */
  aceptar(): void {
    this.insumos.markAllAsTouched();
    if (this.insumos.invalid) return;
    this.referencia.close(this.insumos.getRawValue());
  }

  protected material(id: string): MaterialCatalogo | undefined {
    return this.datos.materiales.find((material) => material.id === id);
  }
}
