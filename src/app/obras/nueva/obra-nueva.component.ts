import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { SesionService } from '../../nucleo/sesion.service';
import { ObrasService } from '../obras.service';
import { crearFormulario, revisarAlCambiarEstado } from './formulario';
import { PasoContratoComponent } from './paso-contrato.component';
import { PasoDatosComponent, type UsuariosPorRol } from './paso-datos.component';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './obra-nueva.component.html',
  styleUrl: './obra-nueva.component.scss',
})
export class ObraNuevaComponent implements OnInit {
  protected readonly sesion = inject(SesionService);
  private readonly servicio = inject(ObrasService);

  protected readonly esAdmin = computed(() => this.sesion.usuario()?.roles.includes('admin') ?? false);
  protected readonly formulario = crearFormulario(inject(NonNullableFormBuilder));
  protected readonly usuarios = signal<UsuariosPorRol>(SIN_USUARIOS);
  protected readonly estadoUsuarios = signal<'cargando' | 'listo' | 'error'>('cargando');

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

  /** «Siguiente»: marca los campos del paso para que se vean sus errores; el stepper lineal no avanza si no es válido. */
  siguiente(paso: 'datos' | 'contrato'): void {
    this.formulario.controls[paso].markAllAsTouched();
    this.stepper()?.next();
  }
}
