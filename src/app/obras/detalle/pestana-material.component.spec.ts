import { TestBed } from '@angular/core/testing';
import { desdeLaRed } from '../../nucleo/plataforma-falsa';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { of, throwError, type Observable } from 'rxjs';
import type { ComparacionMaterial, FilaComparacion, MaterialCorto } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import {
  PestanaMaterialComponent,
  cantidadMaterial,
  diferenciaMaterial,
} from './pestana-material.component';

const CEMENTO: MaterialCorto = {
  id: 'm1',
  codigo: 'CEM-01',
  nombre: 'Cemento IP-30',
  unidad: 'bolsa',
  unidadPlural: 'bolsas',
};
const FIERRO: MaterialCorto = {
  id: 'm2',
  codigo: 'ACE-12',
  nombre: 'Fierro 12 mm',
  unidad: 'kg',
  unidadPlural: 'kg',
};

const FILAS: FilaComparacion[] = [
  {
    partidaId: 'p1',
    partidaCodigo: 'P-01',
    material: CEMENTO,
    previsto: 100,
    usado: 125,
    diferencia: 25,
    excedido: true,
  },
  {
    partidaId: 'p1',
    partidaCodigo: 'P-01',
    material: FIERRO,
    previsto: 200,
    usado: 180.5,
    diferencia: -19.5,
    excedido: false,
  },
];

function montar(
  materialComparado: (id: string, periodo: string) => Observable<ComparacionMaterial | null>,
) {
  TestBed.configureTestingModule({
    imports: [PestanaMaterialComponent],
    providers: [
      {
        provide: ObrasService,
        useValue: desdeLaRed({ materialComparado, consumosAtipicos: () => of([]) }),
      },
    ],
  });
  const fixture = TestBed.createComponent(PestanaMaterialComponent);
  fixture.componentRef.setInput('obraId', 'b1');
  fixture.componentRef.setInput('fechaInicio', '2026-09-10');
  fixture.componentRef.setInput('partidas', [{ id: 'p1', codigo: 'P-01' }]);
  fixture.detectChanges();
  return { fixture, elemento: fixture.nativeElement as HTMLElement };
}

describe('PestanaMaterialComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 1 de noviembre a las 02:00 UTC todavía es 31 de octubre en La Paz
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('formatea cantidades con la unidad en singular o plural y la diferencia con signo', () => {
    expect(cantidadMaterial(1, CEMENTO)).toBe('1 bolsa');
    expect(cantidadMaterial(12.5, CEMENTO)).toBe('12,5 bolsas');
    expect(diferenciaMaterial(25, CEMENTO)).toBe('+25 bolsas');
    expect(diferenciaMaterial(-19.5, FIERRO)).toBe('-19,5 kg');
    expect(diferenciaMaterial(0, FIERRO)).toBe('0 kg');
  });

  it('al abrirse pide el mes actual en La Paz y ofrece los meses desde el inicio de la obra (criterio 3)', async () => {
    const materialComparado = vi.fn((_id: string, periodo: string) =>
      of({ periodo, hayPlanilla: true, filas: FILAS }),
    );
    const { fixture } = montar(materialComparado);
    expect(materialComparado).toHaveBeenCalledExactlyOnceWith('b1', '2026-10');
    const componente = fixture.componentInstance as unknown as {
      periodos(): string[];
      periodo(): string;
    };
    expect(componente.periodos()).toEqual(['2026-10', '2026-09']);
    expect(componente.periodo()).toBe('2026-10');
    // mat-select marca la opción elegida en una microtarea después de crear sus opciones
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('mat-select')?.textContent,
    ).toContain('Octubre 2026');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('.mat-mdc-select-trigger')!
      .click();
    fixture.detectChanges();
    const opciones = [...document.querySelectorAll<HTMLElement>('mat-option')];
    expect(opciones.map((opcion) => opcion.textContent?.trim())).toEqual([
      'Octubre 2026',
      'Septiembre 2026',
    ]);
    expect(opciones[0].getAttribute('aria-selected')).toBe('true');

    // Elegir otro periodo vuelve a pedir el material
    opciones[1].click();
    fixture.detectChanges();
    expect(materialComparado).toHaveBeenLastCalledWith('b1', '2026-09');
  });

  it('muestra previsto, usado y diferencia, con la fila excedida en rojo (criterio 3)', () => {
    const { elemento } = montar((_id, periodo) => of({ periodo, hayPlanilla: true, filas: FILAS }));
    const filas = [...elemento.querySelectorAll('tr.mat-mdc-row')];
    const textoCelda = (celda: Element) =>
      [...celda.querySelectorAll('span, mat-chip')].length
        ? [
            celda.querySelector('span')!.textContent!.trim(),
            celda.querySelector('mat-chip')?.textContent?.trim(),
          ]
            .filter(Boolean)
            .join(' ')
        : celda.textContent?.trim();
    expect(filas.map((fila) => [...fila.querySelectorAll('td')].map(textoCelda))).toEqual([
      ['P-01', 'Cemento IP-30', '100 bolsas', '125 bolsas', '+25 bolsas Excedido'],
      ['P-01', 'Fierro 12 mm', '200 kg', '180,5 kg', '-19,5 kg'],
    ]);
    expect(filas.map((fila) => fila.classList.contains('excedido'))).toEqual([true, false]);
    expect(elemento.textContent).not.toContain('Sin planilla en este periodo');
  });

  it('sin planilla en el periodo lo indica (criterio 5)', () => {
    const filas = [{ ...FILAS[0], previsto: 0, diferencia: 125 }];
    const { elemento } = montar((_id, periodo) => of({ periodo, hayPlanilla: false, filas }));
    expect(elemento.textContent).toContain('Sin planilla en este periodo');
    expect(elemento.textContent).toContain('0 bolsas');
  });

  it('sin filas muestra el estado vacío', () => {
    const { elemento } = montar((_id, periodo) => of({ periodo, hayPlanilla: false, filas: [] }));
    expect(elemento.textContent).toContain('Sin planilla en este periodo');
    expect(elemento.textContent).toContain('No hay material previsto ni usado en este periodo.');
  });

  it('al elegir otro periodo vuelve a pedir el material', () => {
    const materialComparado = vi.fn((_id: string, periodo: string) =>
      of({ periodo, hayPlanilla: true, filas: FILAS }),
    );
    const { fixture } = montar(materialComparado);
    (fixture.componentInstance as unknown as { elegir(periodo: string): void }).elegir('2026-09');
    expect(materialComparado).toHaveBeenLastCalledWith('b1', '2026-09');
  });

  it('si Obras o Materiales no responden muestra «No disponible por el momento» y reintenta (criterio 4)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new CombinedGraphQLErrors({
      data: null,
      errors: [
        {
          message: 'x',
          extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'materiales', estado: 503 },
        },
      ],
    });
    const respuestas: Observable<ComparacionMaterial | null>[] = [
      throwError(() => error),
      of({ periodo: '2026-10', hayPlanilla: true, filas: FILAS }),
    ];
    const { fixture, elemento } = montar(() => respuestas.shift()!);
    expect(elemento.textContent).toContain('No disponible por el momento.');
    elemento.querySelector('app-estado-error button')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(elemento.textContent).toContain('Cemento IP-30');
  });
});
