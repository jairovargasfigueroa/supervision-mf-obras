import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { Router, provideRouter } from '@angular/router';
import type { FormObra } from './formulario';
import { of, throwError } from 'rxjs';
import type { Rol, Usuario, ZonaObra } from '../obras.graphql';
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
    // Zona (401) y las cuatro asignaciones
    expect(elemento.querySelectorAll('mat-select')).toHaveLength(5);
  });

  it('el selector «Zona» ofrece «Sin zona» y las cinco zonas (401, criterio 1)', async () => {
    sesionCon(['admin']);
    const { fixture, elemento } = montar({ usuarios: (rol: Rol) => of(USUARIOS[rol]) });
    const campo = [...elemento.querySelectorAll('mat-form-field')].find((f) =>
      f.querySelector('mat-label')?.textContent?.includes('Zona'),
    )!;
    campo.querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const opciones = [...document.querySelectorAll('mat-option')].map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Sin zona', 'Norte', 'Sur', 'Este', 'Oeste', 'Centro']);
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

  describe('guardar (criterios 6 y 7)', () => {
    function completar(
      componente: { formulario: FormObra },
      monto = 357425,
      zona: ZonaObra | '' = '',
    ): void {
      const { datos, contrato, partidas } = componente.formulario.controls;
      datos.setValue({
        nombre: ' Edificio Las Palmas ',
        ubicacion: 'Santa Cruz',
        zona,
        fechaInicio: '2026-11-01',
        residenteId: 'r1',
        maestroId: 'm1',
        almaceneroId: 'a1',
        clienteId: 'c1',
      });
      contrato.setValue({ monto, plazoDias: 300, anticipoPct: 10, retencionPct: 7, firmadoEn: '2026-10-20' });
      partidas.at(0).setValue({
        codigo: 'P-01',
        nombre: 'Losa',
        unidad: 'm2',
        cantidadContratada: 850,
        precioUnitario: 420.5,
        meses: '',
      });
    }
    const pulsarGuardar = (elemento: HTMLElement) =>
      [...elemento.querySelectorAll('button')].find((b) => b.textContent?.includes('Guardar obra'))!.click();

    it('envía registrarObra y navega al detalle de la obra nueva', () => {
      sesionCon(['admin']);
      const registrar = vi.fn(() => of({ id: 'b9', estado: 'SIN_CONTRATO' as const }));
      const { fixture, elemento } = montar({ usuarios: (rol: Rol) => of(USUARIOS[rol]), registrar });
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      completar(fixture.componentInstance as never);
      fixture.detectChanges();

      pulsarGuardar(elemento);
      expect(registrar).toHaveBeenCalledWith({
        nombre: 'Edificio Las Palmas',
        ubicacion: 'Santa Cruz',
        fechaInicio: '2026-11-01',
        asignaciones: { residenteId: 'r1', maestroId: 'm1', almaceneroId: 'a1', clienteId: 'c1' },
        contrato: { monto: 357425, plazoDias: 300, anticipoPct: 10, retencionPct: 7, firmadoEn: '2026-10-20' },
        partidas: [{ codigo: 'P-01', nombre: 'Losa', unidad: 'm2', cantidadContratada: 850, precioUnitario: 420.5 }],
      });
      expect(navegar.mock.calls[0][0]).toEqual(['..', 'b9']);
    });

    it('envía la zona elegida (401, criterio 1)', () => {
      sesionCon(['admin']);
      const registrar = vi.fn(() => of({ id: 'b9', estado: 'SIN_CONTRATO' as const }));
      const { fixture, elemento } = montar({ usuarios: (rol: Rol) => of(USUARIOS[rol]), registrar });
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      completar(fixture.componentInstance as never, 357425, 'SUR');
      fixture.detectChanges();
      pulsarGuardar(elemento);
      expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ zona: 'SUR' }));
    });

    it('no envía si el presupuesto no coincide con el monto', () => {
      sesionCon(['admin']);
      const registrar = vi.fn();
      const { fixture, elemento } = montar({ usuarios: (rol: Rol) => of(USUARIOS[rol]), registrar });
      completar(fixture.componentInstance as never, 400000);
      fixture.detectChanges();
      pulsarGuardar(elemento);
      fixture.detectChanges();
      expect(registrar).not.toHaveBeenCalled();
      expect(elemento.textContent).toContain(
        'El presupuesto (Bs 357.425,00) no coincide con el monto del contrato (Bs 400.000,00)',
      );
    });

    it('muestra el mensaje del código que devuelve el gateway y vuelve al paso del contrato', () => {
      sesionCon(['admin']);
      const error = new CombinedGraphQLErrors({
        data: null,
        errors: [{ message: 'x', extensions: { codigo: 'CONTRATO_INVALIDO', servicio: 'obras', estado: 422 } }],
      });
      const { fixture, elemento } = montar({
        usuarios: (rol: Rol) => of(USUARIOS[rol]),
        registrar: () => throwError(() => error),
      });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      completar(fixture.componentInstance as never);
      fixture.detectChanges();
      pulsarGuardar(elemento);
      fixture.detectChanges();
      expect(elemento.textContent).toContain('Los datos del contrato no son válidos');
      expect(elemento.querySelector('.mat-step-header[aria-selected="true"]')?.textContent).toContain('Contrato');
    });
  });

  it('si Keycloak no responde ofrece reintentar la carga de usuarios', () => {
    sesionCon(['admin']);
    const { elemento } = montar({ usuarios: () => throwError(() => new Error('sin conexión')) });
    expect(elemento.textContent).toContain('No se pudo cargar la lista de usuarios.');
  });
});
