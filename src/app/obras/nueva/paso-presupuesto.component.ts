import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { formatearMonto } from '../../nucleo/formato';
import { crearPartida, mensajeCampo, revisarAlCambiarEstado, type FormPartida, type FormPartidas } from './formulario';
import { totalPartida } from './presupuesto';

/**
 * Paso 3: presupuesto por partidas (criterio 4). Total por fila y suma al pie, en vivo.
 * Los insumos previstos por partida necesitan el catálogo de Materiales (`materiales`, 003): hasta que el gateway
 * tenga esa consulta, las partidas se registran sin insumos (diseño de la 002).
 */
@Component({
  selector: 'app-paso-presupuesto',
  imports: [ReactiveFormsModule, MatButtonModule, MatIconModule, MatInputModule, MatTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paso-presupuesto.component.html',
  styleUrls: ['./pasos.scss', './paso-presupuesto.component.scss'],
})
export class PasoPresupuestoComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly partidas = input.required<FormPartidas>();
  /** Suma del presupuesto ya calculada por el formulario (se muestra al pie). */
  readonly total = input.required<number>();

  protected readonly columnas = [
    'codigo',
    'nombre',
    'unidad',
    'cantidadContratada',
    'precioUnitario',
    'meses',
    'total',
    'quitar',
  ];
  /** Copia de los controles para que mat-table vuelva a pintar al agregar o quitar filas. */
  private readonly version = signal(0);
  protected readonly filas = computed(() => {
    this.version();
    return [...this.partidas().controls];
  });

  protected readonly mensaje = mensajeCampo;
  protected readonly monto = formatearMonto;

  constructor() {
    revisarAlCambiarEstado(() => this.partidas());
  }

  agregar(): void {
    this.partidas().push(crearPartida(this.fb));
    this.version.update((v) => v + 1);
  }

  quitar(indice: number): void {
    this.partidas().removeAt(indice);
    this.partidas().markAsTouched();
    this.version.update((v) => v + 1);
  }

  protected totalFila(fila: FormPartida): number {
    return totalPartida(fila.getRawValue());
  }

  /** Códigos repetidos (error del arreglo de partidas, en mayúsculas). */
  protected codigosRepetidos(): string[] {
    return (this.partidas().errors?.['codigoRepetido'] as string[] | undefined) ?? [];
  }

  protected codigoRepetido(fila: FormPartida): boolean {
    return this.codigosRepetidos().includes(fila.controls.codigo.value.trim().toUpperCase());
  }
}
