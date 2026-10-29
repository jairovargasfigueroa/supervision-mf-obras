import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import type { EstadoObra } from '../obras/obras.graphql';

/** Etiqueta de cada estado de obra. SIN_CONTRATO se muestra «Registrando contrato» (002, criterio 7). */
export const ETIQUETA_ESTADO_OBRA: Record<EstadoObra, string> = {
  SIN_CONTRATO: 'Registrando contrato',
  EN_EJECUCION: 'En ejecución',
  CONCLUIDA: 'Concluida',
};

/** Estados que se muestran como chip. EN_RIESGO es la etiqueta «En riesgo» de la obra (006, 009). */
export type EstadoMostrable = EstadoObra | 'EN_RIESGO';

const ETIQUETAS: Record<EstadoMostrable, string> = {
  ...ETIQUETA_ESTADO_OBRA,
  EN_RIESGO: 'En riesgo',
};

/** Color de cada estado (docs/diseno-visual.md, «Estados del dominio → color»). */
const COLORES: Record<EstadoMostrable, 'neutro' | 'primario' | 'apagado' | 'exito' | 'atencion' | 'error'> = {
  SIN_CONTRATO: 'neutro',
  EN_EJECUCION: 'primario',
  CONCLUIDA: 'apagado',
  EN_RIESGO: 'atencion',
};

/**
 * Chip de un estado del dominio (docs/diseno-visual.md, «Estados del dominio → color»): fondo suave y texto del
 * color fuerte. SIN_CONTRATO: primario-suave con texto secundario; EN_EJECUCION: primario; «En riesgo»: atención.
 */
@Component({
  selector: 'app-estado-chip',
  imports: [MatChipsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-chip [class]="'chip ' + clase()" disableRipple>{{ etiqueta() }}</mat-chip>`,
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
  protected readonly etiqueta = computed(() => ETIQUETAS[this.estado()]);
  protected readonly clase = computed(() => COLORES[this.estado()]);
}
