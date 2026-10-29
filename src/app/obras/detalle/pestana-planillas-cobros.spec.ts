import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { of, throwError, type Observable } from 'rxjs';
import type { Cobro, PlanillaResumen } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import { PestanaCobrosComponent } from './pestana-cobros.component';
import { PestanaPlanillasComponent } from './pestana-planillas.component';

const filas = (elemento: HTMLElement) =>
  [...elemento.querySelectorAll('tr.mat-mdc-row')].map((fila) =>
    [...fila.querySelectorAll('td')].map((celda) => celda.textContent?.trim()),
  );

const reintentar = (elemento: HTMLElement) =>
  elemento.querySelector('app-estado-error button')!.dispatchEvent(new Event('click'));

describe('PestanaPlanillasComponent', () => {
  function montar(planillas: () => Observable<PlanillaResumen[]>) {
    TestBed.configureTestingModule({
      imports: [PestanaPlanillasComponent],
      providers: [{ provide: ObrasService, useValue: { planillas } }],
    });
    const fixture = TestBed.createComponent(PestanaPlanillasComponent);
    fixture.componentRef.setInput('obraId', 'b1');
    fixture.detectChanges();
    return { fixture, elemento: fixture.nativeElement as HTMLElement };
  }

  it('lista número, periodo, estado y neto, la más reciente primero (criterio 3)', () => {
    const { elemento } = montar(() =>
      of<PlanillaResumen[]>([
        { id: 'pl1', numero: 1, periodo: '2026-11', estado: 'APROBADA', neto: 84630.5 },
        { id: 'pl2', numero: 2, periodo: '2026-12', estado: 'PRESENTADA', neto: 120000 },
      ]),
    );
    expect(filas(elemento)).toEqual([
      ['2', 'Diciembre 2026', 'Presentada', 'Bs 120.000,00'],
      ['1', 'Noviembre 2026', 'Aprobada', 'Bs 84.630,50'],
    ]);
  });

  it('sin planillas muestra el estado vacío', () => {
    expect(montar(() => of([])).elemento.textContent).toContain('Aún no hay planillas.');
  });

  it('mientras el gateway no expone `planillas` (007) muestra el estado vacío, no un error', () => {
    const error = new CombinedGraphQLErrors({
      data: null,
      errors: [{ message: 'Cannot query field "planillas" on type "Obra".', extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }],
    });
    const { elemento } = montar(() => throwError(() => error));
    expect(elemento.textContent).toContain('Aún no hay planillas.');
    expect(elemento.textContent).not.toContain('No disponible por el momento');
  });

  it('si Obras no responde muestra «No disponible por el momento» y reintenta (criterio 4)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new CombinedGraphQLErrors({
      data: null,
      errors: [{ message: 'x', extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'obras', estado: 503 } }],
    });
    const respuestas: Observable<PlanillaResumen[]>[] = [throwError(() => error), of([])];
    const { fixture, elemento } = montar(() => respuestas.shift()!);
    expect(elemento.textContent).toContain('No disponible por el momento.');
    reintentar(elemento);
    fixture.detectChanges();
    expect(elemento.textContent).toContain('Aún no hay planillas.');
  });
});

describe('PestanaCobrosComponent', () => {
  function montar(cobros: () => Observable<Cobro[] | null>) {
    TestBed.configureTestingModule({
      imports: [PestanaCobrosComponent],
      providers: [{ provide: ObrasService, useValue: { cobros } }],
    });
    const fixture = TestBed.createComponent(PestanaCobrosComponent);
    fixture.componentRef.setInput('obraId', 'b1');
    fixture.detectChanges();
    return { fixture, elemento: fixture.nativeElement as HTMLElement };
  }

  it('lista número, emisión, vencimiento, monto y estado (criterio 3)', () => {
    const { elemento } = montar(() =>
      of<Cobro[]>([
        {
          id: 'c1',
          numero: 'COB-0001',
          planillaId: 'pl1',
          montoNeto: 84630.5,
          emitidoEn: '2026-12-02T15:00:00Z',
          venceEn: '2027-01-01',
          estado: 'PENDIENTE',
        },
        {
          id: 'c0',
          numero: 'COB-0000',
          planillaId: 'pl0',
          montoNeto: 1000,
          emitidoEn: '2026-10-02T15:00:00Z',
          venceEn: '2026-11-01',
          estado: 'VENCIDO',
        },
      ]),
    );
    expect(filas(elemento)).toEqual([
      ['COB-0001', '02/12/2026', '01/01/2027', 'Bs 84.630,50', 'Pendiente'],
      ['COB-0000', '02/10/2026', '01/11/2026', 'Bs 1.000,00', 'Vencido'],
    ]);
  });

  it('sin cobros (o null para un rol sin acceso) muestra el estado vacío', () => {
    expect(montar(() => of(null)).elemento.textContent).toContain('Aún no hay cobros.');
  });

  it('si Finanzas no responde muestra «No disponible por el momento» y reintenta (criterio 4)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const respuestas: Observable<Cobro[] | null>[] = [throwError(() => new Error('caído')), of([])];
    const { fixture, elemento } = montar(() => respuestas.shift()!);
    expect(elemento.textContent).toContain('No disponible por el momento.');
    reintentar(elemento);
    fixture.detectChanges();
    expect(elemento.textContent).toContain('Aún no hay cobros.');
  });
});
