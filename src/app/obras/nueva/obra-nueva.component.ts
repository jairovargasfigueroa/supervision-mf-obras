import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map, startWith } from 'rxjs';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { leerError, mensajeDeError, registrarError, type ErrorLeido } from '../../nucleo/errores';
import { formatearImporte, formatearMonto } from '../../nucleo/formato';
import { SesionService } from '../../nucleo/sesion.service';
import { ObrasService } from '../obras.service';
import { aEntrada, codigosRepetidos, crearFormulario, revisarAlCambiarEstado } from './formulario';
import { PasoContratoComponent } from './paso-contrato.component';
import { PasoDatosComponent, type UsuariosPorRol } from './paso-datos.component';
import { PasoPresupuestoComponent } from './paso-presupuesto.component';
import { resumirPresupuesto } from './presupuesto';

const SIN_USUARIOS: UsuariosPorRol = { residente: [], maestro: [], almacenero: [], cliente: [] };

/** «Nueva obra» (002): asistente de tres pasos, solo para `admin` (criterios 1 y 10). */
@Component({
  selector: 'app-obra-nueva',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatStepperModule,
    EstadoVacioComponent,
    PasoDatosComponent,
    PasoContratoComponent,
    PasoPresupuestoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './obra-nueva.component.html',
  styleUrl: './obra-nueva.component.scss',
})
export class ObraNuevaComponent implements OnInit {
  protected readonly sesion = inject(SesionService);
  private readonly servicio = inject(ObrasService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly esAdmin = computed(() => this.sesion.usuario()?.roles.includes('admin') ?? false);
  protected readonly formulario = crearFormulario(inject(NonNullableFormBuilder));
  protected readonly usuarios = signal<UsuariosPorRol>(SIN_USUARIOS);
  protected readonly estadoUsuarios = signal<'cargando' | 'listo' | 'error'>('cargando');

  /** Suma del presupuesto y diferencia con el monto, recalculadas con cada cambio (criterio 5). */
  protected readonly resumen = toSignal(
    this.formulario.valueChanges.pipe(
      startWith(null),
      map(() => {
        const { partidas, contrato } = this.formulario.getRawValue();
        return resumirPresupuesto(partidas, contrato.monto);
      }),
    ),
    { requireSync: true },
  );
  /** Criterio 6: no se puede guardar si la suma no coincide con el monto (tolerancia 0,01). */
  protected readonly mensajePresupuesto = computed(() =>
    this.resumen().coincide ? '' : this.mensaje({ codigo: 'PRESUPUESTO_NO_COINCIDE', estado: 422 }),
  );
  protected readonly bs = formatearMonto;

  protected readonly guardando = signal(false);
  /** Error que devolvió el gateway al guardar: mensaje del código y, si vienen, los errores por campo. */
  protected readonly errorGuardar = signal<{ mensaje: string; errores: ErrorLeido['errores'] } | null>(null);

  private readonly stepper = viewChild(MatStepper);

  constructor() {
    revisarAlCambiarEstado(() => this.formulario);
  }

  ngOnInit(): void {
    if (this.sesion.dentroDelErp() && this.esAdmin()) this.cargarUsuarios();
  }

  /** Las cuatro listas de asignación salen de Keycloak, una consulta por rol. */
  cargarUsuarios(): void {
    this.estadoUsuarios.set('cargando');
    forkJoin({
      residente: this.servicio.usuarios('residente'),
      maestro: this.servicio.usuarios('maestro'),
      almacenero: this.servicio.usuarios('almacenero'),
      cliente: this.servicio.usuarios('cliente'),
    }).subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.estadoUsuarios.set('listo');
      },
      error: () => this.estadoUsuarios.set('error'),
    });
  }

  /** «Guardar»: valida todo; si falta algo vuelve al primer paso con errores. Si Obras responde, va al detalle. */
  guardar(): void {
    this.formulario.markAllAsTouched();
    this.errorGuardar.set(null);
    if (this.formulario.invalid) {
      this.irAlPasoConError();
      return;
    }
    this.guardando.set(true);
    this.servicio.registrar(aEntrada(this.formulario)).subscribe({
      next: ({ id }) => void this.router.navigate(['..', id], { relativeTo: this.ruta }),
      error: (error: unknown) => {
        const leido = leerError(error);
        registrarError('registrarObra', leido);
        this.errorGuardar.set({ mensaje: this.mensaje(leido), errores: leido.errores });
        this.guardando.set(false);
        if (leido.codigo === 'CONTRATO_INVALIDO') this.irAPaso(1);
      },
    });
  }

  /** «Siguiente»: marca los campos del paso para que se vean sus errores; el stepper lineal no avanza si no es válido. */
  siguiente(paso: 'datos' | 'contrato'): void {
    this.formulario.controls[paso].markAllAsTouched();
    this.stepper()?.next();
  }

  private irAlPasoConError(): void {
    const { datos, contrato } = this.formulario.controls;
    this.irAPaso(datos.invalid ? 0 : contrato.invalid ? 1 : 2);
  }

  private irAPaso(indice: number): void {
    const stepper = this.stepper();
    if (stepper) stepper.selectedIndex = indice;
  }

  /** Mensaje de docs/mensajes.md con los marcadores completados con lo que hay en pantalla. */
  private mensaje(error: Pick<ErrorLeido, 'codigo' | 'estado'> & Partial<ErrorLeido>): string {
    const { total, monto } = this.resumen();
    const repetidos = codigosRepetidos(this.formulario.getRawValue().partidas.map((partida) => partida.codigo));
    return mensajeDeError(
      { servicio: null, errores: [], red: false, ...error },
      {
        presupuesto: formatearImporte(total),
        monto: formatearImporte(monto),
        ...(repetidos.length ? { codigo: repetidos.join(', ') } : {}),
      },
    );
  }
}
