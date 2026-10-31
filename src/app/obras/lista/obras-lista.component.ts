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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, merge, type Subscription } from 'rxjs';
import { ETIQUETA_ESTADO_OBRA, EstadoChipComponent } from '../../compartido/estado-chip.component';
import { AvisoSinConexionComponent } from '../../compartido/aviso-sin-conexion.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { leerError, registrarError } from '../../nucleo/errores';
import { formatearFecha, formatearPorcentaje } from '../../nucleo/formato';
import { SesionService } from '../../nucleo/sesion.service';
import type { EstadoObra, FiltrosObras, ObraResumen } from '../obras.graphql';
import { ObrasService } from '../obras.service';

/** Espera tras la última tecla antes de buscar por nombre. */
export const ESPERA_BUSQUEDA_MS = 300;

/**
 * Lista de obras (006, criterios 1 y 2): las que el usuario puede ver, con estado, avance, plazo transcurrido y la
 * etiqueta «En riesgo». Filtra por estado y busca por nombre en el gateway.
 */
@Component({
  selector: 'app-obras-lista',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    EstadoChipComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    AvisoSinConexionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './obras-lista.component.html',
  styleUrl: './obras-lista.component.scss',
})
export class ObrasListaComponent implements OnInit {
  protected readonly sesion = inject(SesionService);
  private readonly servicio = inject(ObrasService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruir = inject(DestroyRef);

  /** Solo admin registra obras (002, criterio 10): residente y gerente no ven «Nueva obra». */
  protected readonly esAdmin = computed(
    () => this.sesion.usuario()?.roles.includes('admin') ?? false,
  );

  protected readonly estados = Object.entries(ETIQUETA_ESTADO_OBRA) as [EstadoObra, string][];
  protected readonly filtroEstado = new FormControl<EstadoObra | ''>('', { nonNullable: true });
  protected readonly filtroBusqueda = new FormControl('', { nonNullable: true });

  protected readonly estado = signal<'cargando' | 'listo' | 'error' | 'sin-datos'>('cargando');
  /** Fecha de los datos guardados en el equipo cuando se muestran sin conexión (104). */
  protected readonly guardadoEn = signal<string | null>(null);
  protected readonly obras = signal<ObraResumen[]>([]);
  /** Hay algún filtro aplicado en la última consulta: la lista vacía no significa «Aún no hay obras». */
  protected readonly conFiltros = signal(false);
  protected readonly fecha = formatearFecha;
  protected readonly porcentaje = formatearPorcentaje;

  private consulta?: Subscription;

  ngOnInit(): void {
    if (!this.sesion.dentroDelErp()) return;
    merge(
      this.filtroEstado.valueChanges,
      this.filtroBusqueda.valueChanges.pipe(
        debounceTime(ESPERA_BUSQUEDA_MS),
        distinctUntilChanged(),
      ),
    )
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe(() => this.cargar());
    this.cargar();
  }

  registrar(): void {
    void this.router.navigate(['nueva'], { relativeTo: this.ruta });
  }

  limpiarFiltros(): void {
    this.filtroEstado.setValue('', { emitEvent: false });
    this.filtroBusqueda.setValue('', { emitEvent: false });
    this.cargar();
  }

  cargar(): void {
    this.consulta?.unsubscribe();
    const filtros = this.filtros();
    this.conFiltros.set(Object.keys(filtros).length > 0);
    this.estado.set('cargando');
    this.consulta = this.servicio
      .listar(filtros)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (respuesta) => {
          this.guardadoEn.set(respuesta?.guardadoEn ?? null);
          if (!respuesta) {
            this.estado.set('sin-datos');
            return;
          }
          this.obras.set(respuesta.datos);
          this.estado.set('listo');
        },
        error: (error: unknown) => {
          registrarError('obras', leerError(error));
          this.estado.set('error');
        },
      });
  }

  private filtros(): FiltrosObras {
    const filtros: FiltrosObras = {};
    const estado = this.filtroEstado.value;
    const busqueda = this.filtroBusqueda.value.trim();
    if (estado) filtros.estado = estado;
    if (busqueda) filtros.busqueda = busqueda;
    return filtros;
  }
}
