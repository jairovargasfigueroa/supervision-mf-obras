import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap, take, takeWhile, timer, type Subscription } from 'rxjs';
import { AvisoSinConexionComponent } from '../../compartido/aviso-sin-conexion.component';
import { EstadoChipComponent } from '../../compartido/estado-chip.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { leerError, mensajeDeError, registrarError } from '../../nucleo/errores';
import {
  formatearFecha,
  formatearMonto,
  formatearNumero,
  formatearPorcentaje,
  formatearZona,
} from '../../nucleo/formato';
import { SesionService } from '../../nucleo/sesion.service';
import { esResidenteAsignado } from '../../planillas/nueva/planilla-nueva.component';
import type { FinanzasObra, Obra } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import { PestanaCobrosComponent } from './pestana-cobros.component';
import { PestanaFotosComponent } from './pestana-fotos.component';
import { PestanaMaterialComponent } from './pestana-material.component';
import { PestanaPlanillasComponent } from './pestana-planillas.component';

/** Cada cuánto se vuelve a consultar la obra mientras Finanzas registra el contrato, y hasta cuándo (diseño 002). */
export const INTERVALO_ESPERA_MS = 2000;
export const ESPERA_MAXIMA_MS = 30000;

/** La obra sigue esperando el contrato: SIN_CONTRATO y sin motivo de rechazo. */
export function esperandoContrato(obra: Obra | null): boolean {
  return obra?.estado === 'SIN_CONTRATO' && !obra.motivoRechazoContrato;
}

/** Ancho de una barra de porcentaje, entre 0 y 100. */
export function anchoBarra(porcentaje: number): number {
  return Math.min(100, Math.max(0, porcentaje));
}

/**
 * Detalle de la obra (006, criterio 3): encabezado con las asignaciones, avance frente al plazo, contrato (con saldo
 * y total cobrado de Finanzas para admin y gerente), tabla de partidas y pestañas Material, Fotos, Planillas y Cobros
 * (esta solo para admin y gerente), cada una con su consulta y su error (criterio 4). Una obra que el usuario no ve muestra «Obra
 * no encontrada» (criterio 6). Mientras el contrato se registra muestra «Registrando contrato…» y consulta cada 2 s
 * (máx. 30 s) hasta EN_EJECUCION o rechazo, que muestra el motivo (002, criterios 8 y 9).
 */
@Component({
  selector: 'app-obra-detalle',
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTabsModule,
    EstadoChipComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    PestanaMaterialComponent,
    PestanaFotosComponent,
    PestanaPlanillasComponent,
    PestanaCobrosComponent,
    AvisoSinConexionComponent,
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
  protected readonly id = signal('');

  protected readonly estado = signal<
    'cargando' | 'listo' | 'no-encontrada' | 'error' | 'sin-datos'
  >('cargando');
  /** Fecha de los datos guardados en el equipo cuando se muestran sin conexión (104). */
  protected readonly guardadoEn = signal<string | null>(null);
  protected readonly obra = signal<Obra | null>(null);
  /** Se pasó el tiempo máximo de espera sin que cambie el estado. */
  protected readonly esperaAgotada = signal(false);
  protected readonly mensajeError = signal('');

  /** Saldo y total cobrado: solo admin y gerente (criterio 3); el resto ni los pide. */
  protected readonly veFinanzas = computed(() => {
    const roles = this.sesion.usuario()?.roles ?? [];
    return roles.includes('admin') || roles.includes('gerente');
  });
  /** «Nueva planilla»: solo el residente asignado y con la obra en ejecución (007, criterios 1 y 10). */
  protected readonly puedeCrearPlanilla = computed(() => {
    const obra = this.obra();
    return obra?.estado === 'EN_EJECUCION' && esResidenteAsignado(obra, this.sesion.usuario());
  });
  protected readonly estadoFinanzas = signal<'sin-pedir' | 'cargando' | 'listo' | 'error'>(
    'sin-pedir',
  );
  protected readonly finanzas = signal<FinanzasObra | null>(null);

  protected readonly columnas = [
    'codigo',
    'nombre',
    'unidad',
    'cantidadContratada',
    'ejecutadaAcumulada',
    'avancePct',
    'precioUnitario',
  ];
  protected readonly monto = formatearMonto;
  protected readonly fecha = formatearFecha;
  protected readonly porcentaje = formatearPorcentaje;
  protected readonly numero = formatearNumero;
  protected readonly zona = formatearZona;
  protected readonly ancho = anchoBarra;
  protected readonly esperando = esperandoContrato;

  private consulta?: Subscription;
  private consultaFinanzas?: Subscription;

  ngOnInit(): void {
    this.ruta.paramMap.pipe(takeUntilDestroyed(this.destruir)).subscribe((parametros) => {
      this.id.set(parametros.get('id') ?? '');
      this.obra.set(null);
      this.consultaFinanzas?.unsubscribe();
      this.finanzas.set(null);
      this.estadoFinanzas.set('sin-pedir');
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
        switchMap(() => this.servicio.obtener(this.id())),
        takeWhile((respuesta) => esperandoContrato(respuesta?.datos ?? null), true),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe({
        next: (respuesta) => {
          this.guardadoEn.set(respuesta?.guardadoEn ?? null);
          if (!respuesta) {
            this.estado.set('sin-datos');
            return;
          }
          const obra = respuesta.datos;
          ultima = obra;
          this.obra.set(obra);
          this.estado.set(obra ? 'listo' : 'no-encontrada');
          // Finanzas tiene el contrato solo después de registrarlo (ContratoRegistrado)
          if (
            obra?.contrato.contratoId &&
            this.veFinanzas() &&
            this.estadoFinanzas() === 'sin-pedir'
          ) {
            this.cargarFinanzas();
          }
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

  /** Si Finanzas no responde, solo el saldo y el total cobrado muestran «No disponible por el momento» (criterio 4). */
  cargarFinanzas(): void {
    this.consultaFinanzas?.unsubscribe();
    this.estadoFinanzas.set('cargando');
    this.consultaFinanzas = this.servicio
      .finanzas(this.id())
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (respuesta) => {
          this.finanzas.set(respuesta?.datos ?? null);
          // Sin conexión y sin datos guardados: «No disponible por el momento», como si Finanzas no respondiera
          this.estadoFinanzas.set(respuesta ? 'listo' : 'error');
        },
        error: (error: unknown) => {
          registrarError('finanzas', leerError(error));
          this.estadoFinanzas.set('error');
        },
      });
  }
}
