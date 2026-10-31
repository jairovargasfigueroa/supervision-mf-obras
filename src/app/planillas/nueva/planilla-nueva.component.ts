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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, type Subscription } from 'rxjs';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { AvisoSinConexionComponent } from '../../compartido/aviso-sin-conexion.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { leerError, mensajeDeError, registrarError } from '../../nucleo/errores';
import { formatearPeriodo } from '../../nucleo/formato';
import { periodoActual, periodosDesde } from '../../nucleo/periodos';
import { SesionService } from '../../nucleo/sesion.service';
import type { PlanillaResumen } from '../../obras/obras.graphql';
import { ObrasService } from '../../obras/obras.service';
import type { ObraDePlanilla } from '../planillas.graphql';
import { PlanillasService } from '../planillas.service';
import { RequiereConexionComponent } from '../../compartido/requiere-conexion.component';
import { ConexionService } from '../../nucleo/conexion.service';

/** El usuario es el residente asignado a la obra: solo él elabora y presenta planillas (criterio 10). */
export function esResidenteAsignado(
  obra: Pick<ObraDePlanilla, 'residente'> | null,
  usuario: { id: string; roles: string[] } | null,
): boolean {
  return (
    !!obra && !!usuario && usuario.roles.includes('residente') && obra.residente?.id === usuario.id
  );
}

/**
 * «Nueva planilla» (007, criterios 1 y 2): el residente asignado elige el mes (desde el inicio de la obra hasta el
 * actual) y se crea en BORRADOR; luego se abre el editor. Si Obras la rechaza, explica el motivo con el texto de
 * cada código (planilla abierta, periodo no posterior, mes futuro).
 */
@Component({
  selector: 'app-planilla-nueva',
  imports: [
    RequiereConexionComponent,
    AvisoSinConexionComponent,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    EstadoErrorComponent,
    EstadoVacioComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planilla-nueva.component.html',
  styleUrl: '../planillas.scss',
})
export class PlanillaNuevaComponent implements OnInit {
  protected readonly conexion = inject(ConexionService);
  protected readonly sesion = inject(SesionService);
  private readonly servicio = inject(PlanillasService);
  private readonly obras = inject(ObrasService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruir = inject(DestroyRef);

  /** Ruta de las rutas del microfrontend (/obras dentro del ERP): base de los enlaces. */
  protected readonly base = this.ruta.parent ?? null;
  protected readonly obraId = signal('');
  protected readonly estado = signal<
    'cargando' | 'listo' | 'no-encontrada' | 'error' | 'sin-datos'
  >('cargando');
  protected readonly obra = signal<ObraDePlanilla | null>(null);
  private readonly planillas = signal<PlanillaResumen[]>([]);
  protected readonly mensajeCarga = signal('');

  protected readonly puedeCrear = computed(() =>
    esResidenteAsignado(this.obra(), this.sesion.usuario()),
  );
  /** Del mes actual (el primero, elegido por defecto) al del inicio de la obra. */
  protected readonly periodos = computed(() => {
    const obra = this.obra();
    return obra ? periodosDesde(obra.fechaInicio, periodoActual()) : [];
  });
  protected readonly nombrePeriodo = formatearPeriodo;

  protected readonly periodo = inject(NonNullableFormBuilder).control(
    periodoActual(),
    Validators.required,
  );
  protected readonly creando = signal(false);
  protected readonly errorCrear = signal('');

  private consulta?: Subscription;

  ngOnInit(): void {
    this.ruta.paramMap.pipe(takeUntilDestroyed(this.destruir)).subscribe((parametros) => {
      this.obraId.set(parametros.get('id') ?? '');
      if (this.sesion.dentroDelErp()) this.cargar();
    });
  }

  /** La obra y sus planillas (estas solo para completar «la última planilla» del mensaje; si fallan, sin el dato). */
  cargar(): void {
    this.consulta?.unsubscribe();
    this.estado.set('cargando');
    this.consulta = forkJoin({
      obra: this.servicio.obra(this.obraId()),
      planillas: this.obras.planillas(this.obraId()).pipe(
        map((respuesta) => respuesta?.datos ?? []),
        catchError(() => of<PlanillaResumen[]>([])),
      ),
    })
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: ({ obra: respuesta, planillas }) => {
          if (!respuesta) {
            // Sin conexión y la obra nunca se abrió en este equipo (104)
            this.estado.set('sin-datos');
            return;
          }
          const obra = respuesta.datos;
          this.obra.set(obra);
          this.planillas.set(planillas);
          this.estado.set(obra ? 'listo' : 'no-encontrada');
        },
        error: (error: unknown) => {
          const leido = leerError(error);
          registrarError('obra de la planilla', leido);
          this.mensajeCarga.set(mensajeDeError(leido));
          this.estado.set(leido.codigo === 'OBRA_NO_ENCONTRADA' ? 'no-encontrada' : 'error');
        },
      });
  }

  crear(): void {
    if (this.periodo.invalid || this.creando()) return;
    this.creando.set(true);
    this.errorCrear.set('');
    this.servicio.crear(this.obraId(), this.periodo.value).subscribe({
      next: (planilla) =>
        void this.router.navigate(['planillas', planilla.id], { relativeTo: this.base }),
      error: (error: unknown) => {
        const leido = leerError(error);
        registrarError('crearPlanilla', leido);
        const ultima = [...this.planillas()].sort((a, b) => b.numero - a.numero)[0];
        this.errorCrear.set(
          mensajeDeError(leido, ultima ? { periodoUltima: formatearPeriodo(ultima.periodo) } : {}),
        );
        this.creando.set(false);
      },
    });
  }
}
