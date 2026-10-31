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
import { FormArray, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, of, switchMap, type Subscription } from 'rxjs';
import { ETIQUETAS, EstadoChipComponent } from '../../compartido/estado-chip.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { AvisoSinConexionComponent } from '../../compartido/aviso-sin-conexion.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { leerError, mensajeDeError, registrarError, type ErrorLeido } from '../../nucleo/errores';
import {
  formatearFechaHora,
  formatearMonto,
  formatearNumero,
  formatearPeriodo,
  formatearPorcentaje,
} from '../../nucleo/formato';
import { SesionService } from '../../nucleo/sesion.service';
import type { Foto } from '../../obras/obras.graphql';
import { esResidenteAsignado } from '../nueva/planilla-nueva.component';
import type { GuardarPlanillaEntrada, ObraDePlanilla, Planilla } from '../planillas.graphql';
import { PlanillasService } from '../planillas.service';
import { calcularLinea, calcularTotales, type LineaCalculada, type Totales } from './totales';
import { RequiereConexionComponent } from '../../compartido/requiere-conexion.component';
import { ConexionService } from '../../nucleo/conexion.service';

/** Texto de la fila que supera lo contratado (criterio 5); el saldo es lo que todavía se puede medir. */
export function mensajeSupera(saldoDisponible: number): string {
  return `Supera lo contratado (saldo: ${formatearNumero(saldoDisponible)})`;
}

/** Texto de arriba cuando hay filas que superan lo contratado (docs/mensajes.md, SUPERA_CANTIDAD_CONTRATADA). */
export const MENSAJE_FILAS_SUPERAN =
  'Hay filas que superan lo contratado. Corrígelas para guardar.';

/**
 * Editor de la planilla (007, criterios 3 a 10): por partida, cantidad contratada, acumulado anterior, cantidad del
 * periodo (editable), acumulado total, saldo y monto; los totales se recalculan al escribir con el mismo cálculo del
 * dominio (`totales.ts`, solo ayuda visual: al guardar manda lo que devuelve Obras). Una fila que supera lo
 * contratado se marca en rojo y bloquea «Guardar». Se adjuntan fotos de avance del periodo elegidas de una galería
 * (criterio 6). «Guardar» avisa si otra persona la guardó antes (VERSION_DESACTUALIZADA) y «Presentar» la pasa a
 * PRESENTADA si el subtotal es mayor a 0 (criterio 8). Solo el residente asignado edita, y solo en BORRADOR u
 * OBSERVADA (que muestra la observación); en otro estado o para admin y gerente, modo lectura (criterios 9 y 10).
 */
@Component({
  selector: 'app-planilla-editor',
  imports: [
    RequiereConexionComponent,
    AvisoSinConexionComponent,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    EstadoChipComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planilla-editor.component.html',
  styleUrls: ['../planillas.scss', './planilla-editor.component.scss'],
})
export class PlanillaEditorComponent implements OnInit {
  protected readonly conexion = inject(ConexionService);
  protected readonly sesion = inject(SesionService);
  private readonly servicio = inject(PlanillasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruir = inject(DestroyRef);

  /** Ruta de las rutas del microfrontend (/obras dentro del ERP): base de los enlaces. */
  protected readonly base = this.ruta.parent ?? null;
  private readonly id = signal('');
  protected readonly estado = signal<
    'cargando' | 'listo' | 'no-encontrada' | 'error' | 'sin-datos'
  >('cargando');
  /** Fecha de la planilla guardada en el equipo cuando se muestra sin conexión (104). */
  protected readonly guardadoEn = signal<string | null>(null);
  protected readonly mensajeCarga = signal('');
  protected readonly planilla = signal<Planilla | null>(null);
  protected readonly obra = signal<ObraDePlanilla | null>(null);

  /** Una cantidad del periodo por línea, en el orden de `planilla.lineas`. */
  protected readonly cantidades = new FormArray<FormControl<number | null>>([]);
  private readonly valores = signal<(number | null)[]>([]);
  private readonly cantidadesValidas = signal(true);
  /** Partidas que Obras rechazó por superar lo contratado (SUPERA_CANTIDAD_CONTRATADA, `errores[].campo`). */
  private readonly superanEnServidor = signal<ReadonlySet<string>>(new Set());

  /** Criterios 9 y 10: BORRADOR u OBSERVADA y el usuario es el residente asignado. */
  protected readonly editable = computed(() => {
    const planilla = this.planilla();
    return (
      !!planilla &&
      (planilla.estado === 'BORRADOR' || planilla.estado === 'OBSERVADA') &&
      esResidenteAsignado(this.obra(), this.sesion.usuario())
    );
  });

  /** En edición, calculadas con lo escrito; en lectura, las que devolvió Obras. */
  protected readonly filas = computed<LineaCalculada[]>(() => {
    const planilla = this.planilla();
    if (!planilla) return [];
    if (!this.editable()) {
      return planilla.lineas.map((linea) => ({
        cantidadPeriodo: linea.cantidadPeriodo,
        acumuladoTotal: linea.acumuladoTotal,
        saldo: linea.saldo,
        saldoDisponible: linea.cantidadContratada - linea.acumuladoAnterior,
        monto: linea.monto,
        supera: false,
      }));
    }
    const valores = this.valores();
    const enServidor = this.superanEnServidor();
    return planilla.lineas.map((linea, i) => {
      const calculada = calcularLinea(linea, valores[i] ?? null);
      return { ...calculada, supera: calculada.supera || enServidor.has(linea.partidaId) };
    });
  });

  protected readonly totales = computed<Totales | null>(() => {
    const planilla = this.planilla();
    if (!planilla) return null;
    if (!this.editable()) return planilla;
    return calcularTotales(
      this.filas().map((fila) => fila.monto),
      planilla.anticipoPct,
      planilla.retencionPct,
    );
  });

  /** Fotos de avance de la obra registradas dentro del periodo (criterio 6). */
  protected readonly fotos = signal<Foto[]>([]);
  protected readonly estadoFotos = signal<'cargando' | 'listo' | 'error'>('cargando');
  protected readonly fotosElegidas = signal<ReadonlySet<string>>(new Set());
  /** En edición, toda la galería del periodo para elegir; en lectura, solo las adjuntas. */
  protected readonly fotosVisibles = computed(() =>
    this.editable()
      ? this.fotos()
      : this.fotos().filter((foto) => this.fotosElegidas().has(foto.id)),
  );

  protected readonly hayFilasQueSuperan = computed(() => this.filas().some((fila) => fila.supera));
  /** Hay cambios sin guardar en las cantidades o en las fotos adjuntas. */
  protected readonly modificada = computed(() => {
    const planilla = this.planilla();
    if (!planilla) return false;
    const elegidas = this.fotosElegidas();
    return (
      this.filas().some((fila, i) => fila.cantidadPeriodo !== planilla.lineas[i].cantidadPeriodo) ||
      elegidas.size !== planilla.fotoIds.length ||
      planilla.fotoIds.some((id) => !elegidas.has(id))
    );
  });
  protected readonly ocupado = signal<'guardando' | 'presentando' | null>(null);
  /** Criterio 5: no se guarda con filas que superan lo contratado (ni con cantidades negativas). */
  protected readonly puedeGuardar = computed(
    () =>
      this.editable() &&
      this.modificada() &&
      !this.hayFilasQueSuperan() &&
      this.cantidadesValidas() &&
      this.ocupado() === null,
  );
  /** Criterio 8: no se presenta con subtotal 0 ni con filas inválidas; si hay cambios, se guardan antes. */
  protected readonly puedePresentar = computed(
    () =>
      this.editable() &&
      !this.hayFilasQueSuperan() &&
      this.cantidadesValidas() &&
      (this.totales()?.subtotal ?? 0) > 0 &&
      this.ocupado() === null &&
      // 104, criterio 17: «Presentar» requiere conexión
      this.conexion.enLinea(),
  );
  protected readonly errorAccion = signal('');
  /** Otra persona guardó la planilla antes: se ofrece «Recargar» (criterio 7). */
  protected readonly versionDesactualizada = signal(false);

  protected readonly columnas = [
    'codigo',
    'nombre',
    'unidad',
    'cantidadContratada',
    'acumuladoAnterior',
    'cantidadPeriodo',
    'acumuladoTotal',
    'saldo',
    'monto',
  ];
  protected readonly monto = formatearMonto;
  protected readonly numero = formatearNumero;
  protected readonly porcentaje = formatearPorcentaje;
  protected readonly nombrePeriodo = formatearPeriodo;
  protected readonly fechaHora = formatearFechaHora;
  protected readonly supera = mensajeSupera;
  protected readonly mensajeFilasSuperan = MENSAJE_FILAS_SUPERAN;

  private consulta?: Subscription;
  private consultaFotos?: Subscription;

  constructor() {
    this.cantidades.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.leerCantidades());
  }

  ngOnInit(): void {
    this.ruta.paramMap.pipe(takeUntilDestroyed(this.destruir)).subscribe((parametros) => {
      this.id.set(parametros.get('id') ?? '');
      if (this.sesion.dentroDelErp()) this.cargar();
    });
  }

  /**
   * La planilla y, con su `obraId`, la obra (nombre y residente); luego las fotos del periodo. Descarta lo que no se
   * guardó. `aviso` arma un mensaje con la planilla recién leída (PLANILLA_NO_EDITABLE).
   */
  cargar(aviso?: (planilla: Planilla) => string): void {
    this.consulta?.unsubscribe();
    this.estado.set('cargando');
    this.errorAccion.set('');
    this.versionDesactualizada.set(false);
    this.consulta = this.servicio
      .obtener(this.id())
      .pipe(
        switchMap((respuesta) =>
          respuesta?.datos
            ? this.servicio.obra(respuesta.datos.obraId).pipe(map((obra) => ({ respuesta, obra })))
            : of({ respuesta, obra: null }),
        ),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe({
        next: ({ respuesta, obra: respuestaObra }) => {
          // Sin conexión y la planilla (o su obra) nunca se abrió en este equipo (104)
          if (!respuesta || (respuesta.datos && !respuestaObra)) {
            this.guardadoEn.set(null);
            this.estado.set('sin-datos');
            return;
          }
          const planilla = respuesta.datos;
          const obra = respuestaObra?.datos ?? null;
          this.guardadoEn.set(respuesta.guardadoEn);
          this.obra.set(obra);
          if (planilla) {
            this.aplicar(planilla);
            this.cargarFotos();
            if (aviso) this.errorAccion.set(aviso(planilla));
          }
          this.estado.set(planilla ? 'listo' : 'no-encontrada');
        },
        error: (error: unknown) => {
          const leido = leerError(error);
          registrarError('planilla', leido);
          this.mensajeCarga.set(mensajeDeError(leido));
          this.estado.set(
            leido.estado === 404 || leido.codigo === 'OBRA_NO_ENCONTRADA'
              ? 'no-encontrada'
              : 'error',
          );
        },
      });
  }

  /** Galería del periodo; si Obras no responde, solo esa sección muestra «No disponible por el momento». */
  cargarFotos(): void {
    const planilla = this.planilla();
    if (!planilla) return;
    this.consultaFotos?.unsubscribe();
    this.estadoFotos.set('cargando');
    this.consultaFotos = this.servicio
      .fotosDelPeriodo(planilla.obraId, planilla.periodo)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (respuesta) => {
          this.fotos.set(respuesta?.datos ?? []);
          this.estadoFotos.set(respuesta ? 'listo' : 'error');
        },
        error: (error: unknown) => {
          registrarError('fotos del periodo', leerError(error));
          this.estadoFotos.set('error');
        },
      });
  }

  /** Adjunta o quita una foto de la planilla (se guarda con «Guardar» o al presentar). */
  alternarFoto(id: string): void {
    this.fotosElegidas.update((elegidas) => {
      const nuevas = new Set(elegidas);
      if (!nuevas.delete(id)) nuevas.add(id);
      return nuevas;
    });
  }

  /** «Guardar» (criterio 7): manda las cantidades y las fotos con la versión leída y muestra lo que devuelve Obras. */
  guardar(): void {
    const planilla = this.planilla();
    if (!planilla || !this.puedeGuardar()) return;
    this.empezar('guardando');
    this.servicio.guardar(planilla.id, this.entrada(planilla)).subscribe({
      next: (guardada) => {
        this.aplicar(guardada);
        this.ocupado.set(null);
      },
      error: (error: unknown) => this.fallo('guardarPlanilla', error),
    });
  }

  /** «Presentar» (criterio 8): con cambios sin guardar, primero los guarda; luego presenta con la versión nueva. */
  presentar(): void {
    const planilla = this.planilla();
    if (!planilla || !this.puedePresentar()) return;
    this.empezar('presentando');
    const guardada = this.modificada()
      ? this.servicio.guardar(planilla.id, this.entrada(planilla))
      : of(planilla);
    guardada
      .pipe(
        switchMap((actual) => {
          this.aplicar(actual);
          return this.servicio.presentar(actual.id, actual.version);
        }),
      )
      .subscribe({
        next: (presentada) => {
          this.aplicar(presentada);
          this.ocupado.set(null);
        },
        error: (error: unknown) => this.fallo('presentarPlanilla', error),
      });
  }

  private empezar(accion: 'guardando' | 'presentando'): void {
    this.ocupado.set(accion);
    this.errorAccion.set('');
    this.versionDesactualizada.set(false);
  }

  private entrada(planilla: Planilla): GuardarPlanillaEntrada {
    return {
      version: planilla.version,
      lineas: planilla.lineas.map((linea, i) => ({
        partidaId: linea.partidaId,
        cantidadPeriodo: this.filas()[i].cantidadPeriodo,
      })),
      fotoIds: [...this.fotosElegidas()],
    };
  }

  private fallo(contexto: string, error: unknown): void {
    const leido: ErrorLeido = leerError(error);
    registrarError(contexto, leido);
    this.ocupado.set(null);
    switch (leido.codigo) {
      case 'PLANILLA_NO_EDITABLE':
        // Cambió de estado (por ejemplo, se presentó desde otra pestaña): se muestra la actual, en lectura
        this.cargar((actual) => mensajeDeError(leido, { estado: ETIQUETAS[actual.estado] }));
        return;
      case 'VERSION_DESACTUALIZADA':
        this.versionDesactualizada.set(true);
        break;
      case 'SUPERA_CANTIDAD_CONTRATADA':
        this.superanEnServidor.set(new Set(leido.errores.map((errorCampo) => errorCampo.campo)));
        break;
    }
    this.errorAccion.set(mensajeDeError(leido));
  }

  /** Muestra la planilla que devolvió Obras y vuelve a armar las cantidades editables y las fotos adjuntas. */
  private aplicar(planilla: Planilla): void {
    this.planilla.set(planilla);
    this.fotosElegidas.set(new Set(planilla.fotoIds));
    this.superanEnServidor.set(new Set());
    this.cantidades.clear({ emitEvent: false });
    for (const linea of planilla.lineas) {
      this.cantidades.push(
        new FormControl<number | null>(linea.cantidadPeriodo, Validators.min(0)),
        {
          emitEvent: false,
        },
      );
    }
    this.leerCantidades(false);
  }

  private leerCantidades(cambioDelUsuario = true): void {
    this.valores.set(this.cantidades.controls.map((control) => control.value));
    this.cantidadesValidas.set(this.cantidades.valid);
    if (cambioDelUsuario) this.superanEnServidor.set(new Set());
  }
}
