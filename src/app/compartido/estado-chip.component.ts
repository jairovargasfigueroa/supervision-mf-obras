import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import type {
  EstadoCobro,
  EstadoObra,
  EstadoPlanilla,
  EstadoRevision,
  Severidad,
} from '../obras/obras.graphql';

/** Etiqueta de cada estado de obra. SIN_CONTRATO se muestra «Registrando contrato» (002, criterio 7). */
export const ETIQUETA_ESTADO_OBRA: Record<EstadoObra, string> = {
  SIN_CONTRATO: 'Registrando contrato',
  EN_EJECUCION: 'En ejecución',
  CONCLUIDA: 'Concluida',
};

/**
 * Estados que se muestran como chip: de obra, de planilla y de cobro. EN_RIESGO es la etiqueta «En riesgo» de la
 * obra (006, 009) y EXCEDIDO la del consumo excedido (006, pestaña «Material»). ATIPICO_* son las revisiones de un
 * consumo atípico (403). SEVERIDAD_* es la
 * severidad de un hallazgo de un agente (502).
 */
export type EstadoMostrable =
  | EstadoObra
  | EstadoPlanilla
  | EstadoCobro
  | 'EN_RIESGO'
  | 'EXCEDIDO'
  | `ATIPICO_${EstadoRevision}`
  | `SEVERIDAD_${Severidad}`;

export const ETIQUETAS: Record<EstadoMostrable, string> = {
  ...ETIQUETA_ESTADO_OBRA,
  BORRADOR: 'Borrador',
  PRESENTADA: 'Presentada',
  APROBANDO: 'En aprobación',
  APROBADA: 'Aprobada',
  OBSERVADA: 'Observada',
  PENDIENTE: 'Pendiente',
  VENCIDO: 'Vencido',
  PAGADO: 'Pagado',
  EN_RIESGO: 'En riesgo',
  EXCEDIDO: 'Excedido',
  ATIPICO_PENDIENTE: 'Pendiente',
  ATIPICO_NORMAL: 'Normal',
  ATIPICO_CONFIRMADO: 'Problema confirmado',
  SEVERIDAD_ALTA: 'Alta',
  SEVERIDAD_MEDIA: 'Media',
  SEVERIDAD_BAJA: 'Baja',
};

/** Color de cada estado (docs/diseno-visual.md, «Estados del dominio → color»). */
const COLORES: Record<EstadoMostrable, 'neutro' | 'primario' | 'apagado' | 'exito' | 'atencion' | 'error'> = {
  SIN_CONTRATO: 'neutro',
  EN_EJECUCION: 'primario',
  CONCLUIDA: 'apagado',
  BORRADOR: 'neutro',
  PRESENTADA: 'atencion',
  APROBANDO: 'atencion',
  APROBADA: 'exito',
  OBSERVADA: 'error',
  // 201: con PAGADO en verde, el cobro PENDIENTE pasa a neutro (diseño de la 201)
  PENDIENTE: 'neutro',
  VENCIDO: 'error',
  PAGADO: 'exito',
  EN_RIESGO: 'atencion',
  EXCEDIDO: 'error',
  ATIPICO_PENDIENTE: 'atencion',
  ATIPICO_NORMAL: 'exito',
  ATIPICO_CONFIRMADO: 'error',
  // 502: como en mf-supervision (decisión del equipo; docs/diseno-visual.md no define la severidad)
  SEVERIDAD_ALTA: 'error',
  SEVERIDAD_MEDIA: 'atencion',
  SEVERIDAD_BAJA: 'neutro',
};

/**
 * Chip de un estado del dominio (docs/diseno-visual.md, «Estados del dominio → color»): fondo suave y texto del
 * color fuerte. SIN_CONTRATO: primario-suave con texto secundario; EN_EJECUCION: primario; «En riesgo»: atención.
 */
@Component({
  selector: 'app-estado-chip',
  imports: [MatChipsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-chip [class]="'chip ' + clase()" disableRipple>{{ texto() ?? etiqueta() }}</mat-chip>`,
  styles: `
    .chip {
      --mat-chip-elevated-container-color: var(--sv-primario-suave);
      --mat-chip-label-text-color: var(--sv-texto-secundario);
      border-radius: 999px;
      pointer-events: none;
    }
    .primario {
      --mat-chip-label-text-color: var(--sv-primario);
    }
    .apagado {
      --mat-chip-elevated-container-color: var(--sv-fondo);
    }
    .exito {
      --mat-chip-elevated-container-color: var(--sv-exito-suave);
      --mat-chip-label-text-color: var(--sv-exito);
    }
    .atencion {
      --mat-chip-elevated-container-color: var(--sv-atencion-suave);
      --mat-chip-label-text-color: var(--sv-atencion);
    }
    .error {
      --mat-chip-elevated-container-color: var(--sv-error-suave);
      --mat-chip-label-text-color: var(--sv-error);
    }
  `,
})
export class EstadoChipComponent {
  readonly estado = input.required<EstadoMostrable>();
  /** Texto en lugar de la etiqueta del estado, con su mismo color (201: «Pagado el 28/04/2027»). */
  readonly texto = input<string | null>(null);
  protected readonly etiqueta = computed(() => ETIQUETAS[this.estado()]);
  protected readonly clase = computed(() => COLORES[this.estado()]);
}
