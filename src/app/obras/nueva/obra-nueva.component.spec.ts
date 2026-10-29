import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { Rol, Usuario } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import { ObraNuevaComponent } from './obra-nueva.component';

const USUARIOS: Record<string, Usuario[]> = {
  residente: [{ id: 'r1', nombre: 'Rosa Vaca', correo: null }],
  maestro: [{ id: 'm1', nombre: 'Juan Pérez', correo: null }],
  almacenero: [{ id: 'a1', nombre: 'Mario Vaca', correo: null }],
  cliente: [{ id: 'c1', nombre: 'Gobierno Municipal', correo: null }],
};

function sesionCon(roles: string[]): void {
  window.plataforma = {
    configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
    sesion: {
      usuario: { id: 'u1', nombre: 'Admin', roles },
      obtenerToken: () => Promise.resolve('t'),
      cerrarSesion: () => undefined,
    },
  };
}

function montar(servicio: Partial<ObrasService>) {
  TestBed.configureTestingModule({
    imports: [ObraNuevaComponent],
    providers: [provideRouter([]), { provide: ObrasService, useValue: servicio }],
  });
  const fixture = TestBed.createComponent(ObraNuevaComponent);
  fixture.detectChanges();
  return { fixture, elemento: fixture.nativeElement as HTMLElement };
}

describe('ObraNuevaComponent', () => {
  afterEach(() => delete window.plataforma);

  it.each([['residente'], ['gerente']])('%s no ve el formulario ni consulta usuarios', (rol) => {
    sesionCon([rol]);
    const usuarios = vi.fn();
    const { elemento } = montar({ usuarios });
    expect(elemento.textContent).toContain('No tienes permiso para hacer esta acción.');
    expect(elemento.querySelector('mat-stepper')).toBeNull();
    expect(usuarios).not.toHaveBeenCalled();
  });

  it('admin ve los tres pasos y las cuatro listas se piden por rol a Keycloak', () => {
    sesionCon(['admin']);
    const usuarios = vi.fn((rol: Rol) => of(USUARIOS[rol]));
    const { elemento } = montar({ usuarios });

    const pasos = [...elemento.querySelectorAll('.mat-step-label')].map((paso) => paso.textContent?.trim());
    expect(pasos).toEqual(['Datos y asignaciones', 'Contrato', 'Presupuesto']);
    expect(usuarios.mock.calls.map(([rol]) => rol)).toEqual(['residente', 'maestro', 'almacenero', 'cliente']);
    expect(elemento.querySelectorAll('mat-select')).toHaveLength(4);
  });

  it('no avanza al contrato con el paso 1 incompleto y muestra los errores', () => {
    sesionCon(['admin']);
    const { fixture, elemento } = montar({ usuarios: (rol: Rol) => of(USUARIOS[rol]) });
    const siguiente = [...elemento.querySelectorAll('button')].find((b) => b.textContent?.includes('Siguiente: contrato'))!;
    siguiente.click();
    fixture.detectChanges();

    expect(elemento.querySelector('.mat-step-header[aria-selected="true"]')?.textContent).toContain('Datos y asignaciones');
    expect(elemento.querySelectorAll('mat-error').length).toBeGreaterThanOrEqual(7);
  });

  it('el total y la diferencia con el monto se calculan en vivo (criterios 5 y 6)', async () => {
    sesionCon(['admin']);
    const { fixture, elemento } = montar({ usuarios: (rol: Rol) => of(USUARIOS[rol]) });
    const componente = fixture.componentInstance as unknown as {
      formulario: import('./formulario').FormObra;
      stepper: () => { selectedIndex: number };
    };
    componente.formulario.controls.contrato.controls.monto.setValue(400000);
    componente.formulario.controls.partidas.at(0).patchValue({ cantidadContratada: 850, precioUnitario: 420.5 });
    componente.formulario.controls.partidas.at(0).markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();

    const resumen = elemento.querySelector('.resumen')!.textContent!;
    expect(resumen).toContain('Bs 357.425,00');
    expect(resumen).toContain('Bs 400.000,00');
    expect(resumen).toContain('Bs -42.575,00');
    expect(componente.formulario.hasError('presupuesto')).toBe(true);
    expect(elemento.textContent).toContain(
      'El presupuesto (Bs 357.425,00) no coincide con el monto del contrato (Bs 400.000,00)',
    );

    componente.formulario.controls.contrato.controls.monto.setValue(357425.01);
    fixture.detectChanges();
    expect(componente.formulario.hasError('presupuesto')).toBe(false);
    expect(elemento.textContent).not.toContain('no coincide con el monto del contrato');
  });

  it('si Keycloak no responde ofrece reintentar la carga de usuarios', () => {
    sesionCon(['admin']);
    const { elemento } = montar({ usuarios: () => throwError(() => new Error('sin conexión')) });
    expect(elemento.textContent).toContain('No se pudo cargar la lista de usuarios.');
  });
});
