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
import type { Subscription } from 'rxjs';
import { AvisoSinConexionComponent } from '../../compartido/aviso-sin-conexion.component';
import { EstadoChipComponent, type EstadoMostrable } from '../../compartido/estado-chip.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { RequiereConexionComponent } from '../../compartido/requiere-conexion.component';
import type { ModoDecision } from '../../compartido/sugerencia-decision/sugerencia-decision.component';
import {
  NOMBRE_AGENTE,
  type Agente,
  type Sugerencia,
} from '../../compartido/sugerencia-decision/sugerencia-decision.graphql';
import { SugerenciaDecisionService } from '../../compartido/sugerencia-decision/sugerencia-decision.service';
import { ConexionService } from '../../nucleo/conexion.service';
import { leerError, registrarError } from '../../nucleo/errores';
import { formatearFechaHora } from '../../nucleo/formato';
import type { AgentesObra, Hallazgo } from '../obras.graphql';
import { ObrasService } from '../obras.service';

/** Nombre de cada tipo de hallazgo para la persona (los mismos que en mf-supervision). */
const TIPO_HALLAZGO: Record<string, string> = {
  ATRASO: 'Atraso',
  RIESGO_DE_ATRASO: 'Riesgo de atraso',
  SIN_REGISTRO_DIARIO: 'Sin registro diario',
  PLANILLA_PENDIENTE: 'Planilla pendiente',
  STOCK_BAJO: 'Stock bajo',
  STOCK_JUSTO: 'Stock justo',
  CONSUMO_EXCEDIDO: 'Consumo excedido',
  SALIDA_SIN_STOCK: 'Salida sin stock',
  CONSUMO_ATIPICO: 'Consumo atípico',
  COBRO_VENCIDO: 'Cobro vencido',
  COBRO_POR_VENCER: 'Cobro por vencer',
  PLANILLA_SIN_RESPUESTA: 'Planilla sin respuesta',
  PLANILLA_OBSERVADA_SIN_CORREGIR: 'Planilla observada sin corregir',
};

export function textoTipoHallazgo(tipo: string): string {
  return TIPO_HALLAZGO[tipo] ?? tipo;
}

/**
 * Agentes que se muestran en la pestaña (502, criterio 17): Seguimiento de obras y, para admin y gerente, Control de
 * cobros. Control de materiales tiene su panel en la pantalla de stock de Materiales (criterio 18).
 */
export function agentesDeLaPestana(veCobros: boolean): Agente[] {
  return veCobros ? ['SEGUIMIENTO_OBRAS', 'CONTROL_COBROS'] : ['SEGUIMIENTO_OBRAS'];
}

/**
 * Pestaña «Agentes» del detalle (502, criterios 17, 19 y 20): hallazgos vigentes (los de la última ejecución
 * TERMINADA de cada agente) y sugerencias pendientes de la obra, con «Aprobar» y «Rechazar» (criterios 12 a 15). El
 * residente solo ve sus obras (el detalle no le abre otras) y nunca Control de cobros. Todo texto del agente se muestra
 * como texto (interpolación de Angular, sin innerHTML).
 */
@Component({
  selector: 'app-pestana-agentes',
  imports: [
    MatButtonModule,
    AvisoSinConexionComponent,
    EstadoChipComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    RequiereConexionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-agentes.component.html',
  styleUrls: ['./pestana.scss', './pestana-agentes.component.scss'],
})
export class PestanaAgentesComponent implements OnInit {
  readonly obraId = input.required<string>();
  /** admin y gerente: también ven Control de cobros (criterio 17). */
  readonly veCobros = input(false);

  private readonly servicio = inject(ObrasService);
  private readonly decision = inject(SugerenciaDecisionService);
  private readonly destruir = inject(DestroyRef);
  protected readonly conexion = inject(ConexionService);

  protected readonly estado = signal<'cargando' | 'listo' | 'error' | 'sin-datos'>('cargando');
  /** Fecha de los datos guardados en el equipo cuando se muestran sin conexión (104). */
  protected readonly guardadoEn = signal<string | null>(null);
  private readonly datos = signal<AgentesObra>({ hallazgos: [], sugerencias: [] });
  /** Otra persona ya decidió la sugerencia o ya no se puede ver (criterio 14): la lista se recarga. */
  protected readonly aviso = signal<string | null>(null);

  private readonly agentes = computed(() => agentesDeLaPestana(this.veCobros()));
  protected readonly hallazgos = computed(() =>
    (this.datos().hallazgos ?? []).filter((h) => this.agentes().includes(h.agente)),
  );
  protected readonly sugerencias = computed(() =>
    (this.datos().sugerencias ?? []).filter((s) => this.agentes().includes(s.agente)),
  );

  protected readonly nombreAgente = NOMBRE_AGENTE;
  protected readonly tipo = textoTipoHallazgo;
  protected readonly fechaHora = formatearFechaHora;

  private consulta?: Subscription;

  protected chip(hallazgo: Hallazgo): EstadoMostrable {
    return `SEVERIDAD_${hallazgo.severidad}`;
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.consulta?.unsubscribe();
    this.estado.set('cargando');
    this.consulta = this.servicio
      .agentes(this.obraId())
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (respuesta) => {
          this.guardadoEn.set(respuesta?.guardadoEn ?? null);
          if (!respuesta) {
            this.estado.set('sin-datos');
            return;
          }
          this.datos.set(respuesta.datos);
          this.estado.set('listo');
        },
        error: (error: unknown) => {
          registrarError('agentes', leerError(error));
          this.estado.set('error');
        },
      });
  }

  /** Abre el diálogo; al decidir (o si ya estaba decidida) vuelve a pedir la pestaña. */
  decidir(sugerencia: Sugerencia, modo: ModoDecision): void {
    this.aviso.set(null);
    this.decision
      .decidir(sugerencia, modo)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe((resultado) => {
        if (!resultado) return;
        if (resultado.tipo === 'aviso') this.aviso.set(resultado.mensaje);
        this.cargar();
      });
  }
}
