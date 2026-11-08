import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { formatearFechaHora } from '../nucleo/formato';

/** Texto del aviso sobre datos guardados en el equipo (104, criterio 8). */
export function avisoDatosGuardados(guardadoEn: string): string {
  return `Sin conexión · datos del ${formatearFechaHora(guardadoEn)}`;
}

export const SIN_DATOS_GUARDADOS = 'No hay datos guardados de esta pantalla';

/**
 * Aviso de la 104 encima de una pantalla con datos del equipo: «Sin conexión · datos del dd/mm/aaaa hh:mm». Sin
 * `guardadoEn` muestra «No hay datos guardados de esta pantalla».
 */
@Component({
  selector: 'app-aviso-sin-conexion',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="aviso" role="status" [class.sin-datos]="!guardadoEn()">
      <mat-icon fontSet="material-symbols-outlined">cloud_off</mat-icon>
      {{ texto() }}
    </p>
  `,
  styles: `
    .aviso {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      padding: 8px 12px;
      color: var(--sv-atencion);
      background: var(--sv-atencion-suave);
      border-radius: var(--sv-radio-control);
      font-size: 14px;
    }
    .aviso.sin-datos {
      padding: 32px 24px;
      justify-content: center;
      color: var(--sv-texto-secundario);
      background: var(--sv-superficie);
      border: 1px solid var(--sv-borde);
      border-radius: var(--sv-radio-tarjeta);
    }
    mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
  `,
})
export class AvisoSinConexionComponent {
  readonly guardadoEn = input<string | null>(null);
  protected readonly texto = computed(() => {
    const guardadoEn = this.guardadoEn();
    return guardadoEn ? avisoDatosGuardados(guardadoEn) : SIN_DATOS_GUARDADOS;
  });
}
