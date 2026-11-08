import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { formatearMonto } from '../../nucleo/formato';
import type { MaterialCatalogo } from '../obras.graphql';
import {
  crearPartida,
  fijarInsumos,
  mensajeCampo,
  revisarAlCambiarEstado,
  type FormPartida,
  type FormPartidas,
  type ValorInsumo,
} from './formulario';
import { InsumosDialogoComponent, type DatosInsumosDialogo } from './insumos-dialogo.component';
import { totalPartida } from './presupuesto';

/**
 * Paso 3: presupuesto por partidas (criterio 4). Total por fila y suma al pie, en vivo. Cada partida puede tener
 * insumos previstos, que se eligen del catálogo de Materiales (`materiales`, 003) en un diálogo. Si el catálogo no
 * carga, las partidas se pueden registrar sin insumos (diseño de la 002).
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
  private readonly dialogo = inject(MatDialog);

  readonly partidas = input.required<FormPartidas>();
  /** Suma del presupuesto ya calculada por el formulario (se muestra al pie). */
  readonly total = input.required<number>();
  /** Materiales activos del catálogo para los insumos. */
  readonly materiales = input<readonly MaterialCatalogo[]>([]);
  readonly estadoMateriales = input<'cargando' | 'listo' | 'error'>('listo');
  readonly reintentarMateriales = output<void>();

  protected readonly columnas = [
    'codigo',
    'nombre',
    'unidad',
    'cantidadContratada',
    'precioUnitario',
    'meses',
    'insumos',
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

  /** Abre el diálogo de insumos de la partida; al aceptar, reemplaza sus insumos. */
  editarInsumos(fila: FormPartida): void {
    const { codigo, nombre, unidad } = fila.getRawValue();
    this.dialogo
      .open<InsumosDialogoComponent, DatosInsumosDialogo, ValorInsumo[]>(InsumosDialogoComponent, {
        data: {
          partida: { codigo, nombre, unidad },
          materiales: this.materiales(),
          insumos: fila.controls.insumos.getRawValue(),
        },
        width: '640px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((insumos) => {
        if (!insumos) return;
        fijarInsumos(fila, this.fb, insumos);
        this.version.update((v) => v + 1);
      });
  }

  /** Texto del botón de insumos de la fila. */
  protected textoInsumos(fila: FormPartida): string {
    const cantidad = fila.controls.insumos.length;
    if (cantidad === 0) return 'Agregar';
    return cantidad === 1 ? '1 insumo' : `${cantidad} insumos`;
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
