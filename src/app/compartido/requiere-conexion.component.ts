import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConexionService, REQUIERE_CONEXION } from '../nucleo/conexion.service';

/**
 * Envuelve un botón que escribe (104, criterio 9): sin conexión muestra la ayuda «Requiere conexión». El botón se
 * deshabilita en su propio componente con `conexion.enLinea()` (un botón deshabilitado no muestra su ayuda, por eso
 * va en este contenedor).
 */
@Component({
  selector: 'app-requiere-conexion',
  imports: [MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="contenedor"
      [matTooltip]="ayuda"
      [matTooltipDisabled]="conexion.enLinea()"
      [attr.aria-label]="conexion.enLinea() ? null : ayuda"
    >
      <ng-content />
    </span>
  `,
  styles: `
    :host,
    .contenedor {
      display: inline-flex;
    }
  `,
})
export class RequiereConexionComponent {
  protected readonly conexion = inject(ConexionService);
  protected readonly ayuda = REQUIERE_CONEXION;
}
