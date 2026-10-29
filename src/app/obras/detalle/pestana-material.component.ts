import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import type { Subscription } from 'rxjs';
import { EstadoChipComponent } from '../../compartido/estado-chip.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { leerError, registrarError } from '../../nucleo/errores';
import { formatearCantidad, formatearPeriodo } from '../../nucleo/formato';
import { periodoActual, periodosDesde } from '../../nucleo/periodos';
import type { ComparacionMaterial, MaterialCorto } from '../obras.graphql';
import { ObrasService } from '../obras.service';

/** `12,5 bolsas` (unidad en plural salvo para 1). */
export function cantidadMaterial(cantidad: number, material: MaterialCorto): string {
  return formatearCantidad(cantidad, Math.abs(cantidad) === 1 ? material.unidad : material.unidadPlural);
}

/** Diferencia con signo: `+12,5 bolsas` si se usó más de lo previsto. */
export function diferenciaMaterial(diferencia: number, material: MaterialCorto): string {
  return `${diferencia > 0 ? '+' : ''}${cantidadMaterial(diferencia, material)}`;
}

/**
 * Pestaña «Material» (006, criterios 3 y 5): para el periodo elegido (por defecto el mes actual en La Paz), material
 * previsto, usado y diferencia por partida; la fila va en rojo si está excedido (lo calcula el gateway). Pide sus datos
 * al abrirse y si Obras o Materiales no responden muestra «No disponible por el momento» (criterio 4).
 */
@Component({
  selector: 'app-pestana-material',
  imports: [
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTableModule,
    EstadoChipComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-material.component.html',
  styleUrl: './pestana.scss',
})
export class PestanaMaterialComponent implements OnInit {
  readonly obraId = input.required<string>();
  /** `AAAA-MM-DD`: el selector ofrece los meses desde el inicio de la obra. */
  readonly fechaInicio = input.required<string>();

  private readonly servicio = inject(ObrasService);
  private readonly destruir = inject(DestroyRef);
  private readonly mesActual = periodoActual();

  protected readonly periodo = signal(this.mesActual);
  protected readonly periodos = computed(() => periodosDesde(this.fechaInicio(), this.mesActual));
  protected readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  protected readonly comparacion = signal<ComparacionMaterial | null>(null);

  protected readonly columnas = ['partida', 'material', 'previsto', 'usado', 'diferencia'];
  protected readonly nombrePeriodo = formatearPeriodo;
  protected readonly cantidad = cantidadMaterial;
  protected readonly diferencia = diferenciaMaterial;

  private consulta?: Subscription;

  ngOnInit(): void {
    this.cargar();
  }

  elegir(periodo: string): void {
    this.periodo.set(periodo);
    this.cargar();
  }

  cargar(): void {
    this.consulta?.unsubscribe();
    this.estado.set('cargando');
    this.consulta = this.servicio
      .materialComparado(this.obraId(), this.periodo())
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (comparacion) => {
          this.comparacion.set(comparacion);
          this.estado.set('listo');
        },
        error: (error: unknown) => {
          registrarError('materialComparado', leerError(error));
          this.estado.set('error');
        },
      });
  }
}
