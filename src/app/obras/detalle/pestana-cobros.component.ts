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
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Subscription } from 'rxjs';
import { EstadoChipComponent } from '../../compartido/estado-chip.component';
import { AvisoSinConexionComponent } from '../../compartido/aviso-sin-conexion.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { RequiereConexionComponent } from '../../compartido/requiere-conexion.component';
import { ConexionService } from '../../nucleo/conexion.service';
import { leerError, registrarError } from '../../nucleo/errores';
import { formatearFecha, formatearFechaHora, formatearMonto } from '../../nucleo/formato';
import { fechaActual } from '../../nucleo/periodos';
import type { Cobro, TipoEnvioCobro } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import {
  PagoDialogoComponent,
  type DatosPagoDialogo,
  type ResultadoPago,
} from './pago-dialogo.component';

/** Etiqueta de cada correo enviado al cliente por un cobro (201, criterio 17). */
export const ETIQUETA_ENVIO: Record<TipoEnvioCobro, string> = {
  NOTA_COBRO: 'Nota enviada',
  RECORDATORIO_POR_VENCER: 'Recordatorio por vencer',
  RECORDATORIO_VENCIDO: 'Recordatorio de vencido',
  CONSTANCIA_PAGO: 'Constancia enviada',
};

export const NOTA_SIN_ENVIAR = 'Nota sin enviar';

export interface EtiquetaCorreo {
  texto: string;
  /** Fecha y hora del envío en La Paz (*tooltip*); null en «Nota sin enviar». */
  enviadoEn: string | null;
  /** «Nota sin enviar»: en ámbar. */
  sinEnviar: boolean;
}

/**
 * Columna «Correos» (201, criterio 17): una etiqueta por envío, en el orden en que llegan (Finanzas los ordena por
 * `enviadoEn`), y «Nota sin enviar» al principio si no hay `NOTA_COBRO`. `envios` puede faltar en datos guardados en
 * el equipo antes de la 201 (104).
 */
export function etiquetasCorreos(cobro: Pick<Cobro, 'envios'>): EtiquetaCorreo[] {
  const envios = cobro.envios ?? [];
  const etiquetas: EtiquetaCorreo[] = envios.map((envio) => ({
    texto: ETIQUETA_ENVIO[envio.tipo],
    enviadoEn: formatearFechaHora(envio.enviadoEn),
    sinEnviar: false,
  }));
  if (!envios.some((envio) => envio.tipo === 'NOTA_COBRO')) {
    etiquetas.unshift({ texto: NOTA_SIN_ENVIAR, enviadoEn: null, sinEnviar: true });
  }
  return etiquetas;
}

/** «Pagado el 28/04/2027» para un cobro PAGADO (201, criterio 3); null en los demás. */
/** «Registrar pago»: solo en cobros PENDIENTE o VENCIDO (201, criterio 1). */
export function admitePago(cobro: Pick<Cobro, 'estado'>): boolean {
  return cobro.estado === 'PENDIENTE' || cobro.estado === 'VENCIDO';
}

export const AVISO_PAGO_REGISTRADO = 'Pago registrado';

export function textoPagado(cobro: Pick<Cobro, 'estado' | 'pagadoEn'>): string | null {
  return cobro.estado === 'PAGADO' && cobro.pagadoEn
    ? `Pagado el ${formatearFecha(cobro.pagadoEn)}`
    : null;
}

/**
 * Pestaña «Cobros» (006, criterio 3; solo admin y gerente, el detalle no la muestra a los demás): número, emisión,
 * vencimiento, monto, estado y correos. Si Finanzas no responde, «No disponible por el momento» (criterio 4). 201:
 * estado `PAGADO` en verde con «Pagado el dd/mm/aaaa» y el comprobante debajo; columna «Correos» con los envíos de
 * la automatización (fecha y hora en el *tooltip*) y «Nota sin enviar» en ámbar; «Registrar pago» (solo admin, en
 * cobros PENDIENTE o VENCIDO; desactivado sin conexión, 104) abre el diálogo y al terminar avisa «Pago registrado»
 * y vuelve a pedir los cobros. `gerente` ve el estado y los datos del pago, sin el botón (criterio 5).
 */
@Component({
  selector: 'app-pestana-cobros',
  imports: [
    MatButtonModule,
    MatTableModule,
    MatTooltipModule,
    EstadoChipComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    AvisoSinConexionComponent,
    RequiereConexionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-cobros.component.html',
  styleUrls: ['./pestana.scss', './pestana-cobros.component.scss'],
})
export class PestanaCobrosComponent implements OnInit {
  readonly obraId = input.required<string>();
  /** Solo admin (201, criterios 1 y 5). */
  readonly puedeRegistrarPago = input(false);

  private readonly servicio = inject(ObrasService);
  private readonly destruir = inject(DestroyRef);
  private readonly dialogos = inject(MatDialog);
  private readonly avisos = inject(MatSnackBar);
  protected readonly conexion = inject(ConexionService);

  protected readonly estado = signal<'cargando' | 'listo' | 'error' | 'sin-datos'>('cargando');
  /** Fecha de los datos guardados en el equipo cuando se muestran sin conexión (104). */
  protected readonly guardadoEn = signal<string | null>(null);
  protected readonly cobros = signal<Cobro[]>([]);
  /** «El cobro ya está pagado.» o «No se encontró el cobro.» al intentar pagar (criterio 4); recarga la pestaña. */
  protected readonly aviso = signal<string | null>(null);
  protected readonly columnas = computed(() => [
    'numero',
    'emitidoEn',
    'venceEn',
    'montoNeto',
    'estado',
    'correos',
    ...(this.puedeRegistrarPago() ? ['acciones'] : []),
  ]);
  protected readonly monto = formatearMonto;
  protected readonly fecha = formatearFecha;
  protected readonly correos = etiquetasCorreos;
  protected readonly pagado = textoPagado;
  protected readonly admitePago = admitePago;

  private consulta?: Subscription;

  ngOnInit(): void {
    this.cargar();
  }

  /** Abre «Registrar pago»; al registrar avisa «Pago registrado» y, en todo caso salvo Cancelar, recarga la tabla. */
  registrarPago(cobro: Cobro): void {
    this.aviso.set(null);
    const datos: DatosPagoDialogo = {
      cobro,
      hoy: fechaActual(),
      enviar: (pagadoEn, comprobante) =>
        this.servicio.registrarPagoCobro(cobro.id, pagadoEn, comprobante),
    };
    this.dialogos
      .open<PagoDialogoComponent, DatosPagoDialogo, ResultadoPago>(PagoDialogoComponent, {
        data: datos,
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe((resultado) => {
        if (!resultado) return;
        if (resultado.tipo === 'aviso') this.aviso.set(resultado.mensaje);
        else this.avisos.open(AVISO_PAGO_REGISTRADO, undefined, { duration: 5000 });
        this.cargar();
      });
  }

  cargar(): void {
    this.consulta?.unsubscribe();
    this.estado.set('cargando');
    this.consulta = this.servicio
      .cobros(this.obraId())
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (respuesta) => {
          this.guardadoEn.set(respuesta?.guardadoEn ?? null);
          if (!respuesta) {
            this.estado.set('sin-datos');
            return;
          }
          this.cobros.set(respuesta.datos ?? []);
          this.estado.set('listo');
        },
        error: (error: unknown) => {
          registrarError('cobros', leerError(error));
          this.estado.set('error');
        },
      });
  }
}
