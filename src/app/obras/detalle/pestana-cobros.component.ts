import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTableModule } from '@angular/material/table';
import type { Subscription } from 'rxjs';
import { EstadoChipComponent } from '../../compartido/estado-chip.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { leerError, registrarError } from '../../nucleo/errores';
import { formatearFecha, formatearMonto } from '../../nucleo/formato';
import type { Cobro } from '../obras.graphql';
import { ObrasService } from '../obras.service';

/**
 * Pestaña «Cobros» (006, criterio 3; solo admin y gerente, el detalle no la muestra a los demás): número, emisión,
 * vencimiento, monto y estado. Si Finanzas no responde, «No disponible por el momento» (criterio 4).
 */
@Component({
  selector: 'app-pestana-cobros',
  imports: [MatTableModule, EstadoChipComponent, EstadoErrorComponent, EstadoVacioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-cobros.component.html',
  styleUrl: './pestana.scss',
})
export class PestanaCobrosComponent implements OnInit {
  readonly obraId = input.required<string>();

  private readonly servicio = inject(ObrasService);
  private readonly destruir = inject(DestroyRef);

  protected readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  protected readonly cobros = signal<Cobro[]>([]);
  protected readonly columnas = ['numero', 'emitidoEn', 'venceEn', 'montoNeto', 'estado'];
  protected readonly monto = formatearMonto;
  protected readonly fecha = formatearFecha;

  private consulta?: Subscription;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.consulta?.unsubscribe();
    this.estado.set('cargando');
    this.consulta = this.servicio
      .cobros(this.obraId())
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (cobros) => {
          this.cobros.set(cobros ?? []);
          this.estado.set('listo');
        },
        error: (error: unknown) => {
          registrarError('cobros', leerError(error));
          this.estado.set('error');
        },
      });
  }
}
