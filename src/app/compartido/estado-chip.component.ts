import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import type { EstadoObra } from '../obras/obras.graphql';

/** Etiqueta de cada estado de obra. SIN_CONTRATO se muestra «Registrando contrato» (002, criterio 7). */
export const ETIQUETA_ESTADO_OBRA: Record<EstadoObra, string> = {
  SIN_CONTRATO: 'Registrando contrato',
  EN_EJECUCION: 'En ejecución',
  CONCLUIDA: 'Concluida',
};

/**
 * Chip del estado de la obra (docs/diseno-visual.md, «Estados del dominio → color»): fondo suave y texto del color
 * fuerte. SIN_CONTRATO: primario-suave con texto secundario; EN_EJECUCION: primario.
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
    .en-ejecucion {
      --mat-chip-label-text-color: var(--sv-primario);
    }
    .concluida {
      --mat-chip-elevated-container-color: var(--sv-fondo);
    }
  `,
})
export class EstadoChipComponent {
  readonly estado = input.required<EstadoObra>();
  protected readonly etiqueta = computed(() => ETIQUETA_ESTADO_OBRA[this.estado()]);
  protected readonly clase = computed(() => this.estado().toLowerCase().replace('_', '-'));
}
