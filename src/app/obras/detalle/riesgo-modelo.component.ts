import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { NivelRiesgo, RiesgoRetraso } from '../obras.graphql';

/** Aviso cuando el servicio de IA no responde (402, criterio 12; docs/mensajes.md). */
export const AVISO_IA_NO_DISPONIBLE = 'Datos de IA no disponibles';

/** Porcentaje entero de una probabilidad de 0 a 1: `0.724` → `72 %`. */
export function porcentajeRiesgo(probabilidad: number): string {
  return `${Math.round(probabilidad * 100)} %`;
}

/**
 * Valor que sigue a «Riesgo de retraso (modelo): » (402, criterios 2, 10 y 12): `ALTO · 72 %`, `Sin datos
 * suficientes` o `—` si IA no respondió (`null`).
 */
export function valorRiesgo(riesgo: RiesgoRetraso | null): string {
  if (!riesgo) return '—';
  if (riesgo.nivel === 'SIN_DATOS' || riesgo.probabilidad === null) return 'Sin datos suficientes';
  return `${riesgo.nivel} · ${porcentajeRiesgo(riesgo.probabilidad)}`;
}

/** Factores que más suben el riesgo, uno por línea, para el *tooltip* (criterio 3). */
export function textoFactores(riesgo: RiesgoRetraso | null): string {
  if (!riesgo || riesgo.nivel === 'SIN_DATOS') return '';
  return riesgo.factores.map((factor) => factor.descripcion).join('\n');
}

/** Color de cada nivel (402, diseño: BAJO verde, MEDIO amarillo, ALTO rojo, SIN_DATOS gris). */
const TONOS: Record<NivelRiesgo, 'exito' | 'atencion' | 'error' | 'neutro'> = {
  BAJO: 'exito',
  MEDIO: 'atencion',
  ALTO: 'error',
  SIN_DATOS: 'neutro',
};

/**
 * Riesgo de retraso que da el modelo (402, criterio 10), en el encabezado del detalle junto a «En riesgo» (la regla de
 * Obras, que es otra señal): nivel y porcentaje con los factores al pasar el cursor, «Sin datos suficientes», o «—»
 * con «Datos de IA no disponibles» si IA no respondió.
 */
@Component({
  selector: 'app-riesgo-modelo',
  imports: [MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      [class]="'riesgo ' + tono()"
      [matTooltip]="factores()"
      [matTooltipDisabled]="!factores()"
      matTooltipClass="factores-riesgo"
      [attr.tabindex]="factores() ? 0 : null"
    >
      Riesgo de retraso (modelo): <strong>{{ valor() }}</strong>
    </span>
    @if (!riesgo()) {
      <span class="aviso">{{ aviso }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
    }
    .riesgo {
      padding: 4px 12px;
      font-size: 14px;
      border-radius: 999px;
      color: var(--sv-texto-secundario);
      background: var(--sv-fondo);
    }
    .exito {
      color: var(--sv-exito);
      background: var(--sv-exito-suave);
    }
    .atencion {
      color: var(--sv-atencion);
      background: var(--sv-atencion-suave);
    }
    .error {
      color: var(--sv-error);
      background: var(--sv-error-suave);
    }
    strong {
      font-weight: 600;
    }
    .aviso {
      font-size: 12px;
      color: var(--sv-texto-secundario);
    }
    ::ng-deep .factores-riesgo {
      white-space: pre-line;
    }
  `,
})
export class RiesgoModeloComponent {
  /** `null`: IA no respondió (el campo llegó en null con SERVICIO_NO_DISPONIBLE). */
  readonly riesgo = input.required<RiesgoRetraso | null>();

  protected readonly aviso = AVISO_IA_NO_DISPONIBLE;
  protected readonly valor = computed(() => valorRiesgo(this.riesgo()));
  protected readonly factores = computed(() => textoFactores(this.riesgo()));
  protected readonly tono = computed(() => {
    const riesgo = this.riesgo();
    return riesgo ? TONOS[riesgo.nivel] : 'neutro';
  });
}
