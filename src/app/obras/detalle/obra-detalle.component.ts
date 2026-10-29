import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap, take, takeWhile, timer, type Subscription } from 'rxjs';
import { EstadoChipComponent } from '../../compartido/estado-chip.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { leerError, mensajeDeError, registrarError } from '../../nucleo/errores';
import { formatearCantidad, formatearFecha, formatearMonto, formatearPorcentaje } from '../../nucleo/formato';
import { SesionService } from '../../nucleo/sesion.service';
import type { Obra } from '../obras.graphql';
import { ObrasService } from '../obras.service';

/** Cada cuánto se vuelve a consultar la obra mientras Finanzas registra el contrato, y hasta cuándo (diseño 002). */
export const INTERVALO_ESPERA_MS = 2000;
export const ESPERA_MAXIMA_MS = 30000;

/** La obra sigue esperando el contrato: SIN_CONTRATO y sin motivo de rechazo. */
export function esperandoContrato(obra: Obra | null): boolean {
  return obra?.estado === 'SIN_CONTRATO' && !obra.motivoRechazoContrato;
}

/**
 * Detalle básico de la obra (002): datos, asignaciones, contrato y partidas. Mientras el contrato se registra muestra
 * «Registrando contrato…» y consulta cada 2 s (máx. 30 s) hasta EN_EJECUCION o rechazo, que muestra el motivo
 * (criterios 8 y 9). La 006 agrega avance, plazo, material, fotos, planillas y cobros.
 */
@Component({
  selector: 'app-obra-detalle',
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTableModule,
    EstadoChipComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './obra-detalle.component.html',
  styleUrl: './obra-detalle.component.scss',
})
export class ObraDetalleComponent implements OnInit {
  protected readonly sesion = inject(SesionService);
  private readonly servicio = inject(ObrasService);
  private readonly destruir = inject(DestroyRef);

  private readonly ruta = inject(ActivatedRoute);
  /** Parámetro :id de la ruta (el shell no usa withComponentInputBinding: se lee de ActivatedRoute). */
  private id = '';

  protected readonly estado = signal<'cargando' | 'listo' | 'no-encontrada' | 'error'>('cargando');
  protected readonly obra = signal<Obra | null>(null);
  /** Se pasó el tiempo máximo de espera sin que cambie el estado. */
  protected readonly esperaAgotada = signal(false);
  protected readonly mensajeError = signal('');

  protected readonly columnas = ['codigo', 'nombre', 'cantidadContratada', 'precioUnitario', 'meses'];
  protected readonly monto = formatearMonto;
  protected readonly fecha = formatearFecha;
  protected readonly porcentaje = formatearPorcentaje;
  protected readonly cantidad = formatearCantidad;
  protected readonly esperando = esperandoContrato;

  private consulta?: Subscription;

  ngOnInit(): void {
    this.ruta.paramMap.pipe(takeUntilDestroyed(this.destruir)).subscribe((parametros) => {
      this.id = parametros.get('id') ?? '';
      this.obra.set(null);
      if (this.sesion.dentroDelErp()) this.cargar();
    });
  }

  /** Consulta la obra; si está esperando el contrato repite cada 2 s hasta 30 s. */
  cargar(): void {
    this.consulta?.unsubscribe();
    this.esperaAgotada.set(false);
    if (!this.obra()) this.estado.set('cargando');
    const intentos = ESPERA_MAXIMA_MS / INTERVALO_ESPERA_MS + 1;
    let ultima: Obra | null = null;
    this.consulta = timer(0, INTERVALO_ESPERA_MS)
      .pipe(
        take(intentos),
        switchMap(() => this.servicio.obtener(this.id)),
        takeWhile((obra) => esperandoContrato(obra), true),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe({
        next: (obra) => {
          ultima = obra;
          this.obra.set(obra);
          this.estado.set(obra ? 'listo' : 'no-encontrada');
        },
        error: (error: unknown) => {
          const leido = leerError(error);
          registrarError('obra', leido);
          this.mensajeError.set(mensajeDeError(leido));
          this.estado.set(leido.codigo === 'OBRA_NO_ENCONTRADA' ? 'no-encontrada' : 'error');
        },
        complete: () => this.esperaAgotada.set(esperandoContrato(ultima)),
      });
  }
}
