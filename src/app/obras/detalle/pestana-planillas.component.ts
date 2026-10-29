import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTableModule } from '@angular/material/table';
import type { Subscription } from 'rxjs';
import { EstadoChipComponent } from '../../compartido/estado-chip.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { esCampoNoExpuesto, leerError, registrarError } from '../../nucleo/errores';
import { formatearMonto, formatearPeriodo } from '../../nucleo/formato';
import type { PlanillaResumen } from '../obras.graphql';
import { ObrasService } from '../obras.service';

/**
 * Pestaña «Planillas» (006, criterio 3): número, periodo, estado y neto, la más reciente primero. Las planillas llegan
 * con la 007: mientras el gateway no expone `planillas`, se muestra el estado vacío. Si no responde, «No disponible
 * por el momento» (criterio 4).
 */
@Component({
  selector: 'app-pestana-planillas',
  imports: [MatTableModule, EstadoChipComponent, EstadoErrorComponent, EstadoVacioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-planillas.component.html',
  styleUrl: './pestana.scss',
})
export class PestanaPlanillasComponent implements OnInit {
  readonly obraId = input.required<string>();

  private readonly servicio = inject(ObrasService);
  private readonly destruir = inject(DestroyRef);

  protected readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  protected readonly planillas = signal<PlanillaResumen[]>([]);
  protected readonly columnas = ['numero', 'periodo', 'estado', 'neto'];
  protected readonly monto = formatearMonto;
  protected readonly nombrePeriodo = formatearPeriodo;

  private consulta?: Subscription;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.consulta?.unsubscribe();
    this.estado.set('cargando');
    this.consulta = this.servicio
      .planillas(this.obraId())
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (planillas) => {
          this.planillas.set([...planillas].sort((a, b) => b.numero - a.numero));
          this.estado.set('listo');
        },
        error: (error: unknown) => {
          // Hasta la 007 el esquema del gateway no tiene el campo: no hay planillas que mostrar
          if (esCampoNoExpuesto(error)) {
            this.planillas.set([]);
            this.estado.set('listo');
            return;
          }
          registrarError('planillas', leerError(error));
          this.estado.set('error');
        },
      });
  }
}
