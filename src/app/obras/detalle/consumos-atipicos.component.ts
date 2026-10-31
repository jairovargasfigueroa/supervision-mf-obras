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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import type { Subscription } from 'rxjs';
import { AvisoSinConexionComponent } from '../../compartido/aviso-sin-conexion.component';
import {
  EstadoChipComponent,
  type EstadoMostrable,
} from '../../compartido/estado-chip.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { RequiereConexionComponent } from '../../compartido/requiere-conexion.component';
import { ConexionService } from '../../nucleo/conexion.service';
import { AVISO_IA_NO_DISPONIBLE, leerError, registrarError } from '../../nucleo/errores';
import { formatearCantidad, formatearFechaHora, formatearNumero } from '../../nucleo/formato';
import type { ConsumoAtipico, EstadoRevision, Partida } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import {
  RevisionDialogoComponent,
  type DatosRevisionDialogo,
  type DecisionRevision,
  type ResultadoRevision,
} from './revision-dialogo.component';

/** Filtro de la sección: un estado de revisión o todos (403, criterio 6). */
export type FiltroRevision = EstadoRevision | 'TODOS';

export const FILTROS_REVISION: [FiltroRevision, string][] = [
  ['PENDIENTE', 'Pendientes'],
  ['NORMAL', 'Normales'],
  ['CONFIRMADO', 'Confirmados'],
  ['TODOS', 'Todos'],
];

/** `120 bolsas` con la unidad del material (en singular para 1); sin material, solo la cifra. */
export function cantidadConsumo(consumo: Pick<ConsumoAtipico, 'cantidad' | 'material'>): string {
  const { cantidad, material } = consumo;
  if (!material) return formatearNumero(cantidad);
  return formatearCantidad(cantidad, Math.abs(cantidad) === 1 ? material.unidad : material.unidadPlural);
}

/** Puntaje de 0 a 1 con dos decimales (`0,71`) y su ancho de barra en porcentaje. */
export function puntajeConsumo(puntaje: number): { texto: string; ancho: number } {
  const acotado = Math.min(1, Math.max(0, puntaje));
  return { texto: formatearNumero(Math.round(acotado * 100) / 100), ancho: acotado * 100 };
}

/**
 * Sección «Consumos atípicos» de la pestaña «Material» (403, criterio 6), debajo de la comparación previsto/usado y
 * con su propio manejo de error: fecha y hora, material, partida (código de las partidas que ya trae el detalle),
 * cantidad, puntaje, motivos y estado; por defecto los PENDIENTE, con filtro por estado. Si IA no responde muestra
 * «—» con «Datos de IA no disponibles» y el resto de la pestaña sigue normal (criterio 12). Es otra señal que el
 * «Excedido» de la comparación (criterio 5). El residente asignado y `admin` marcan los PENDIENTE como «Es normal» o
 * «Confirmar problema» (criterios 7 a 9); `gerente` solo los ve.
 */
@Component({
  selector: 'app-consumos-atipicos',
  imports: [
    AvisoSinConexionComponent,
    EstadoChipComponent,
    EstadoVacioComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    RequiereConexionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consumos-atipicos.component.html',
  styleUrls: ['./pestana.scss', './consumos-atipicos.component.scss'],
})
export class ConsumosAtipicosComponent implements OnInit {
  readonly obraId = input.required<string>();
  /** Partidas del detalle: dan el código de la partida de cada salida. */
  readonly partidas = input.required<Pick<Partida, 'id' | 'codigo'>[]>();
  /** Residente asignado o admin (criterio 7): ven «Es normal» y «Confirmar problema» en los PENDIENTE. */
  readonly puedeRevisar = input(false);

  private readonly servicio = inject(ObrasService);
  private readonly destruir = inject(DestroyRef);
  private readonly dialogos = inject(MatDialog);
  protected readonly conexion = inject(ConexionService);

  protected readonly filtros = FILTROS_REVISION;
  protected readonly filtro = signal<FiltroRevision>('PENDIENTE');
  protected readonly estado = signal<'cargando' | 'listo' | 'error' | 'sin-datos'>('cargando');
  /** Fecha de los datos guardados en el equipo cuando se muestran sin conexión (104). */
  protected readonly guardadoEn = signal<string | null>(null);
  protected readonly consumos = signal<ConsumoAtipico[]>([]);
  protected readonly avisoIa = AVISO_IA_NO_DISPONIBLE;
  /** «Este consumo ya fue revisado» (criterio 8) u otro aviso que recarga la lista. */
  protected readonly aviso = signal<string | null>(null);

  protected readonly codigos = computed(
    () => new Map(this.partidas().map((partida) => [partida.id, partida.codigo])),
  );
  protected readonly columnas = computed(() => [
    'fecha',
    'material',
    'partida',
    'cantidad',
    'puntaje',
    'motivos',
    'estado',
    ...(this.puedeRevisar() ? ['acciones'] : []),
  ]);
  protected readonly fechaHora = formatearFechaHora;
  protected readonly cantidad = cantidadConsumo;
  protected readonly puntaje = puntajeConsumo;

  private consulta?: Subscription;

  protected chip(consumo: ConsumoAtipico): EstadoMostrable {
    return `ATIPICO_${consumo.estadoRevision}`;
  }

  ngOnInit(): void {
    this.cargar();
  }

  elegir(filtro: FiltroRevision): void {
    this.filtro.set(filtro);
    this.aviso.set(null);
    this.cargar();
  }

  /** Abre el diálogo del comentario; al guardar (o si ya estaba revisado) vuelve a pedir la lista. */
  revisar(consumo: ConsumoAtipico, estado: DecisionRevision): void {
    this.aviso.set(null);
    const datos: DatosRevisionDialogo = {
      estado,
      enviar: (comentario) => this.servicio.revisarConsumoAtipico(consumo.id, estado, comentario),
    };
    this.dialogos
      .open<RevisionDialogoComponent, DatosRevisionDialogo, ResultadoRevision>(
        RevisionDialogoComponent,
        { data: datos, autoFocus: 'textarea' },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe((resultado) => {
        if (!resultado) return;
        if (resultado.tipo === 'aviso') this.aviso.set(resultado.mensaje);
        this.cargar();
      });
  }

  cargar(): void {
    this.consulta?.unsubscribe();
    this.estado.set('cargando');
    const filtro = this.filtro();
    this.consulta = this.servicio
      .consumosAtipicos(this.obraId(), filtro === 'TODOS' ? null : filtro)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (respuesta) => {
          this.guardadoEn.set(respuesta?.guardadoEn ?? null);
          if (!respuesta) {
            this.estado.set('sin-datos');
            return;
          }
          this.consumos.set(respuesta.datos);
          this.estado.set('listo');
        },
        error: (error: unknown) => {
          registrarError('consumosAtipicos', leerError(error));
          this.estado.set('error');
        },
      });
  }
}
