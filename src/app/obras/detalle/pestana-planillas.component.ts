import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';
import { EstadoChipComponent } from '../../compartido/estado-chip.component';
import { AvisoSinConexionComponent } from '../../compartido/aviso-sin-conexion.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { esCampoNoExpuesto, leerError, registrarError } from '../../nucleo/errores';
import { formatearMonto, formatearPeriodo } from '../../nucleo/formato';
import type { PlanillaResumen } from '../obras.graphql';
import { ObrasService } from '../obras.service';

/**
 * Pestaña «Planillas» (006, criterio 3): número, periodo, estado y neto, la más reciente primero. Las planillas llegan
 * con la 007: mientras el gateway no expone `planillas`, se muestra el estado vacío. Si no responde, «No disponible
 * por el momento» (criterio 4). El residente asignado ve «Nueva planilla» y el periodo abre la planilla (007). 008: el
 * número del cobro de las aprobadas («—» si no tiene); la observación se ve al abrir la planilla (la lista del contrato
 * no la trae).
 */
@Component({
  selector: 'app-pestana-planillas',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    EstadoChipComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    AvisoSinConexionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-planillas.component.html',
  styleUrl: './pestana.scss',
})
export class PestanaPlanillasComponent implements OnInit {
  readonly obraId = input.required<string>();
  /** El usuario es el residente asignado y la obra está en ejecución: ve «Nueva planilla» (007, criterio 1). */
  readonly puedeCrear = input(false);

  private readonly servicio = inject(ObrasService);
  /** Rutas del microfrontend (/obras en el ERP): el editor está en planillas/{id} (007). */
  protected readonly base = inject(ActivatedRoute).parent ?? null;
  private readonly destruir = inject(DestroyRef);

  protected readonly estado = signal<'cargando' | 'listo' | 'error' | 'sin-datos'>('cargando');
  /** Fecha de los datos guardados en el equipo cuando se muestran sin conexión (104). */
  protected readonly guardadoEn = signal<string | null>(null);
  protected readonly planillas = signal<PlanillaResumen[]>([]);
  protected readonly columnas = ['numero', 'periodo', 'estado', 'neto', 'cobro'];
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
        next: (respuesta) => {
          this.guardadoEn.set(respuesta?.guardadoEn ?? null);
          if (!respuesta) {
            this.estado.set('sin-datos');
            return;
          }
          this.planillas.set([...respuesta.datos].sort((a, b) => b.numero - a.numero));
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
