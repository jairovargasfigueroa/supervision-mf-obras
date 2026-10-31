import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ETIQUETA_ZONA } from '../../nucleo/formato';
import type { Usuario, ZonaObra } from '../obras.graphql';
import { mensajeCampo, revisarAlCambiarEstado, type FormDatos } from './formulario';

export type RolAsignado = 'residente' | 'maestro' | 'almacenero' | 'cliente';

export type UsuariosPorRol = Record<RolAsignado, Usuario[]>;

/**
 * Paso 1: datos de la obra (con la zona opcional, 401) y asignaciones elegidas entre los usuarios de Keycloak con cada
 * rol (criterio 2).
 */
@Component({
  selector: 'app-paso-datos',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paso-datos.component.html',
  styleUrl: './pasos.scss',
})
export class PasoDatosComponent {
  readonly grupo = input.required<FormDatos>();
  readonly usuarios = input.required<UsuariosPorRol>();
  readonly estadoUsuarios = input.required<'cargando' | 'listo' | 'error'>();
  readonly reintentarUsuarios = output<void>();

  protected readonly asignaciones: { rol: RolAsignado; campo: keyof FormDatos['controls']; etiqueta: string }[] = [
    { rol: 'residente', campo: 'residenteId', etiqueta: 'Residente' },
    { rol: 'maestro', campo: 'maestroId', etiqueta: 'Maestro de obra' },
    { rol: 'almacenero', campo: 'almaceneroId', etiqueta: 'Almacenero' },
    { rol: 'cliente', campo: 'clienteId', etiqueta: 'Cliente' },
  ];

  protected readonly zonas = Object.entries(ETIQUETA_ZONA) as [ZonaObra, string][];
  protected readonly mensaje = mensajeCampo;

  constructor() {
    revisarAlCambiarEstado(() => this.grupo());
  }
}
