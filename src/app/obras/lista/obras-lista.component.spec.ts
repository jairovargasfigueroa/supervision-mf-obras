import { TestBed } from '@angular/core/testing';
import { desdeLaRed, instalarPlataformaFalsa } from '../../nucleo/plataforma-falsa';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import type { FiltrosObras, ObraResumen } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import { ESPERA_BUSQUEDA_MS, ObrasListaComponent } from './obras-lista.component';

const OBRA: ObraResumen = {
  id: 'b1',
  nombre: 'Edificio Las Palmas',
  ubicacion: 'Santa Cruz',
  zona: null,
  estado: 'EN_EJECUCION',
  fechaInicio: '2026-11-01',
  avancePct: 32.5,
  plazoPct: 41,
  enRiesgo: false,
};

function montar(respuesta: (filtros?: FiltrosObras) => Observable<ObraResumen[]>) {
  TestBed.configureTestingModule({
    imports: [ObrasListaComponent],
    providers: [
      provideRouter([]),
      { provide: ObrasService, useValue: desdeLaRed({ listar: respuesta }) },
    ],
  });
  const fixture = TestBed.createComponent(ObrasListaComponent);
  fixture.detectChanges();
  return { fixture, elemento: fixture.nativeElement as HTMLElement };
}

describe('ObrasListaComponent', () => {
  afterEach(() => delete window.plataforma);

  it('fuera del ERP pide abrir la pantalla desde el ERP y no consulta', () => {
    let consultas = 0;
    const { elemento } = montar(() => {
      consultas++;
      return of([]);
    });
    expect(elemento.textContent).toContain('Abre esta pantalla desde el ERP.');
    expect(consultas).toBe(0);
  });

  describe('dentro del ERP', () => {
    beforeEach(() => {
      window.plataforma = { configuracion: { gatewayUrl: 'http://localhost:4000/graphql' } };
    });

    it('muestra el estado vacío cuando el gateway devuelve la lista vacía', () => {
      expect(montar(() => of([])).elemento.textContent).toContain('Aún no hay obras.');
    });

    it('muestra el estado de error si la consulta falla', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { elemento } = montar(() => throwError(() => new Error('sin conexión')));
      expect(elemento.textContent).toContain('No disponible por el momento.');
    });

    it('lista las obras con ubicación, estado, avance y plazo transcurrido (criterio 1)', () => {
      const { elemento } = montar(() => of([OBRA]));
      const texto = elemento.textContent?.replace(/\s+/g, ' ');
      expect(texto).toContain('Edificio Las Palmas');
      expect(texto).toContain('Santa Cruz');
      expect(texto).toContain('Inicio 01/11/2026 · Avance 32,5 % · Plazo transcurrido 41 %');
      expect(texto).toContain('En ejecución');
      expect(texto).not.toContain('En riesgo');
      expect(elemento.querySelector('a.obra')?.getAttribute('href')).toBe('/b1');
    });

    it('muestra la zona de cada obra, o «Sin zona» (401, criterio 2)', () => {
      const { elemento } = montar(() => of([OBRA, { ...OBRA, id: 'b2', zona: 'NORTE' }]));
      const secundarios = [...elemento.querySelectorAll('a.obra .secundario')].map((s) =>
        s.textContent?.trim(),
      );
      expect(secundarios).toEqual(['Santa Cruz · Sin zona', 'Santa Cruz · Zona Norte']);
    });

    it('una obra en riesgo lleva la etiqueta «En riesgo» (criterio 1)', () => {
      const { elemento } = montar(() =>
        of([{ ...OBRA, avancePct: 20, plazoPct: 45, enRiesgo: true }]),
      );
      const chips = [...elemento.querySelectorAll('app-estado-chip')].map((chip) =>
        chip.textContent?.trim(),
      );
      expect(chips).toEqual(['En riesgo', 'En ejecución']);
    });

    it('una obra SIN_CONTRATO lleva la etiqueta «Registrando contrato» (002, criterio 7)', () => {
      const obra: ObraResumen = {
        ...OBRA,
        id: 'b2',
        estado: 'SIN_CONTRATO',
        avancePct: 0,
        plazoPct: 0,
      };
      expect(
        montar(() => of([obra]))
          .elemento.querySelector('app-estado-chip')
          ?.textContent?.trim(),
      ).toBe('Registrando contrato');
    });

    describe('filtros (criterio 2)', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('la búsqueda por nombre consulta al gateway tras dejar de escribir, sin espacios sobrantes', async () => {
        const listar = vi.fn((_filtros?: FiltrosObras) => of([OBRA]));
        const { fixture, elemento } = montar(listar);
        expect(listar).toHaveBeenLastCalledWith({});

        const campo = elemento.querySelector('input[type="search"]') as HTMLInputElement;
        campo.value = '  Palm';
        campo.dispatchEvent(new Event('input'));
        campo.value = '  Palmas ';
        campo.dispatchEvent(new Event('input'));
        await vi.advanceTimersByTimeAsync(ESPERA_BUSQUEDA_MS);
        fixture.detectChanges();

        expect(listar).toHaveBeenCalledTimes(2);
        expect(listar).toHaveBeenLastCalledWith({ busqueda: 'Palmas' });
      });

      it('el filtro de estado se manda junto con la búsqueda', async () => {
        const listar = vi.fn((_filtros?: FiltrosObras) => of([OBRA]));
        const { fixture } = montar(listar);
        const componente = fixture.componentInstance as unknown as {
          filtroEstado: { setValue(v: string): void };
          filtroBusqueda: { setValue(v: string): void };
        };
        componente.filtroBusqueda.setValue('Palmas');
        await vi.advanceTimersByTimeAsync(ESPERA_BUSQUEDA_MS);
        componente.filtroEstado.setValue('CONCLUIDA');
        expect(listar).toHaveBeenLastCalledWith({ estado: 'CONCLUIDA', busqueda: 'Palmas' });
      });

      it('sin resultados con filtros ofrece quitarlos en lugar de «Aún no hay obras.»', async () => {
        const listar = vi.fn((filtros?: FiltrosObras) => of(filtros?.estado ? [] : [OBRA]));
        const { fixture, elemento } = montar(listar);
        (
          fixture.componentInstance as unknown as { filtroEstado: { setValue(v: string): void } }
        ).filtroEstado.setValue('CONCLUIDA');
        fixture.detectChanges();
        expect(elemento.textContent).toContain('Ninguna obra coincide con la búsqueda.');
        expect(elemento.textContent).not.toContain('Aún no hay obras.');

        [...elemento.querySelectorAll('button')]
          .find((b) => b.textContent?.includes('Quitar filtros'))!
          .click();
        fixture.detectChanges();
        expect(listar).toHaveBeenLastCalledWith({});
        expect(elemento.textContent).toContain('Edificio Las Palmas');
      });
    });

    describe('botón «Nueva obra» (002, criterio 10)', () => {
      const conRoles = (roles: string[]) => {
        window.plataforma!.sesion = {
          usuario: { id: 'u1', nombre: 'Usuario', roles },
          obtenerToken: () => Promise.resolve('t'),
          cerrarSesion: () => undefined,
        };
      };
      const botonNueva = (elemento: HTMLElement) =>
        [...elemento.querySelectorAll('a')].find((enlace) =>
          enlace.textContent?.includes('Nueva obra'),
        );

      it('admin lo ve y el estado vacío ofrece «Registrar obra»', () => {
        conRoles(['admin']);
        const { elemento } = montar(() => of([]));
        expect(botonNueva(elemento)?.getAttribute('href')).toBe('/nueva');
        expect(elemento.textContent).toContain('Registrar obra');
      });

      it.each([['residente'], ['gerente']])('%s no lo ve', (rol) => {
        conRoles([rol]);
        const { elemento } = montar(() => of([]));
        expect(botonNueva(elemento)).toBeUndefined();
        expect(elemento.textContent).not.toContain('Registrar obra');
      });
    });
  });

  describe('sin conexión (104)', () => {
    beforeEach(() => {
      window.plataforma = { configuracion: { gatewayUrl: 'http://localhost:4000/graphql' } };
    });

    function montarConRespaldo(respuesta: unknown) {
      TestBed.configureTestingModule({
        imports: [ObrasListaComponent],
        providers: [
          provideRouter([]),
          { provide: ObrasService, useValue: { listar: () => of(respuesta) } },
        ],
      });
      const fixture = TestBed.createComponent(ObrasListaComponent);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('muestra las obras guardadas con «Sin conexión · datos del …»', () => {
      const elemento = montarConRespaldo({
        datos: [OBRA],
        desdeEquipo: true,
        guardadoEn: '2026-11-15T18:30:00Z',
      });
      expect(elemento.textContent).toContain('Sin conexión · datos del 15/11/2026 14:30');
      expect(elemento.textContent).toContain('Edificio Las Palmas');
    });

    it('si la lista nunca se abrió en el equipo lo dice', () => {
      const elemento = montarConRespaldo(null);
      expect(elemento.textContent).toContain('No hay datos guardados de esta pantalla');
      expect(elemento.textContent).not.toContain('Aún no hay obras');
    });

    it('sin conexión deshabilita «Nueva obra» con «Requiere conexión»', () => {
      instalarPlataformaFalsa({
        enLinea: false,
        usuario: { id: 'a1', nombre: 'Admin', roles: ['admin'] },
      });
      const elemento = montarConRespaldo({
        datos: [],
        desdeEquipo: true,
        guardadoEn: '2026-11-15T18:30:00Z',
      });
      const nueva = elemento.querySelector<HTMLAnchorElement>(
        'a[routerLink="nueva"], a[href="/nueva"]',
      )!;
      expect(nueva.textContent).toContain('Nueva obra');
      expect(nueva.getAttribute('aria-disabled')).toBe('true');
      expect(elemento.querySelector('app-requiere-conexion span')?.getAttribute('aria-label')).toBe(
        'Requiere conexión',
      );
      expect(elemento.textContent).not.toContain('Registrar obra');
    });
  });
});
