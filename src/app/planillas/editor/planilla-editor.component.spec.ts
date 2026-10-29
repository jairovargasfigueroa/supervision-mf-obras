import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import type { GuardarPlanillaEntrada, ObraDePlanilla, Planilla } from '../planillas.graphql';
import { PlanillasService } from '../planillas.service';
import { PlanillaEditorComponent } from './planilla-editor.component';

const OBRA: ObraDePlanilla = {
  id: 'b1',
  nombre: 'Edificio Las Palmas',
  estado: 'EN_EJECUCION',
  fechaInicio: '2026-01-15',
  residente: { id: 'r1', nombre: 'Rosa Vaca' },
};

/** Planilla con dos partidas: la losa ya tiene 300 de 850 aprobados. */
const PLANILLA: Planilla = {
  id: 'pl1',
  obraId: 'b1',
  numero: 3,
  periodo: '2026-11',
  estado: 'BORRADOR',
  version: 2,
  lineas: [
    {
      partidaId: 'p1',
      codigo: 'P-01',
      nombre: 'Losa',
      unidad: 'm2',
      precioUnitario: 420.5,
      cantidadContratada: 850,
      acumuladoAnterior: 300,
      cantidadPeriodo: 0,
      acumuladoTotal: 300,
      saldo: 550,
      monto: 0,
    },
    {
      partidaId: 'p2',
      codigo: 'P-02',
      nombre: 'Muro',
      unidad: 'm2',
      precioUnitario: 100,
      cantidadContratada: 200,
      acumuladoAnterior: 0,
      cantidadPeriodo: 0,
      acumuladoTotal: 0,
      saldo: 200,
      monto: 0,
    },
  ],
  subtotal: 0,
  descuentoAnticipo: 0,
  retencion: 0,
  neto: 0,
  anticipoPct: 10,
  retencionPct: 7,
  observacion: null,
  fotoIds: [],
};

const errorGraphql = (codigo: string, estado: number, errores: { campo: string; mensaje: string }[] = []) =>
  new CombinedGraphQLErrors({
    data: null,
    errors: [{ message: 'x', extensions: { codigo, estado, servicio: 'obras', errores } }],
  });

interface Opciones {
  usuario?: { id: string; roles: string[] };
  planilla?: Partial<Planilla>;
  obtener?: () => Observable<Planilla | null>;
  guardar?: (id: string, entrada: GuardarPlanillaEntrada) => Observable<Planilla>;
  presentar?: (id: string, version: number) => Observable<Planilla>;
  fotos?: PlanillasService['fotosDelPeriodo'];
}

function montarEditor(opciones: Opciones = {}) {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const usuario = opciones.usuario ?? { id: 'r1', roles: ['residente'] };
  window.plataforma = {
    configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
    sesion: {
      usuario: { ...usuario, nombre: 'Usuario' },
      obtenerToken: () => Promise.resolve('t'),
      cerrarSesion: () => undefined,
    },
  };
  const planilla = { ...PLANILLA, ...opciones.planilla };
  const servicio = {
    obtener: vi.fn(opciones.obtener ?? (() => of(planilla))),
    obra: vi.fn(() => of(OBRA)),
    guardar: vi.fn(opciones.guardar ?? (() => of(planilla))),
    presentar: vi.fn(opciones.presentar ?? (() => of(planilla))),
    fotosDelPeriodo: vi.fn(opciones.fotos ?? (() => of([]))),
  };
  TestBed.configureTestingModule({
    imports: [PlanillaEditorComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'pl1' })), parent: null } },
      { provide: PlanillasService, useValue: servicio },
    ],
  });
  const fixture = TestBed.createComponent(PlanillaEditorComponent);
  fixture.detectChanges();
  const elemento = fixture.nativeElement as HTMLElement;

  const entradas = () => [...elemento.querySelectorAll<HTMLInputElement>('input[type="number"]')];
  const escribir = (indice: number, valor: string) => {
    const entrada = entradas()[indice];
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const boton = (texto: string) =>
    [...elemento.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim().startsWith(texto));
  const pulsar = (texto: string) => {
    boton(texto)!.click();
    fixture.detectChanges();
  };
  const totales = () =>
    [...elemento.querySelectorAll('.totales dd')].map((celda) => celda.textContent?.trim());
  const filas = () => [...elemento.querySelectorAll('tr.mat-mdc-row')];
  const aviso = () => elemento.querySelector('[role="alert"]')?.textContent?.trim();
  return { fixture, elemento, servicio, entradas, escribir, boton, pulsar, totales, filas, aviso };
}

describe('PlanillaEditorComponent (edición)', () => {
  afterEach(() => delete window.plataforma);

  it('muestra por partida contratada, acumulados, saldo y monto (criterio 3)', () => {
    const { filas, escribir } = montarEditor();
    escribir(0, '120');
    const celdas = [...filas()[0].querySelectorAll('td')].map((celda) => celda.textContent?.trim());
    expect(celdas).toEqual(['P-01', 'Losa', 'm2', '850', '300', '', '420', '430', 'Bs 50.460,00']);
  });

  it('recalcula subtotal, anticipo, retención y neto al escribir (criterio 4)', () => {
    const { totales, escribir } = montarEditor();
    expect(totales()).toEqual(['Bs 0,00', 'Bs 0,00', 'Bs 0,00', 'Bs 0,00']);
    escribir(0, '120');
    expect(totales()).toEqual(['Bs 50.460,00', 'Bs 5.046,00', 'Bs 3.532,20', 'Bs 41.881,80']);
    escribir(1, '10');
    expect(totales()).toEqual(['Bs 51.460,00', 'Bs 5.146,00', 'Bs 3.602,20', 'Bs 42.711,80']);
  });

  it('una fila que supera lo contratado queda en rojo con su saldo y bloquea «Guardar» (criterio 5)', () => {
    const { filas, escribir, boton, aviso, elemento } = montarEditor();
    escribir(0, '550');
    expect(filas()[0].classList).not.toContain('supera');
    expect(boton('Guardar')!.disabled).toBe(false);

    escribir(0, '551');
    expect(filas()[0].classList).toContain('supera');
    expect(filas()[0].textContent).toContain('Supera lo contratado (saldo: 550)');
    expect(aviso()).toBe('Hay filas que superan lo contratado. Corrígelas para guardar.');
    expect(boton('Guardar')!.disabled).toBe(true);

    escribir(0, '550');
    expect(elemento.querySelector('tr.supera')).toBeNull();
    expect(boton('Guardar')!.disabled).toBe(false);
  });

  it('una cantidad negativa no se puede guardar', () => {
    const { escribir, boton } = montarEditor();
    escribir(1, '-1');
    expect(boton('Guardar')!.disabled).toBe(true);
  });

  it('«Guardar» manda las cantidades con la versión leída y muestra lo que devuelve Obras', () => {
    const guardada: Planilla = {
      ...PLANILLA,
      version: 3,
      lineas: [{ ...PLANILLA.lineas[0], cantidadPeriodo: 120, acumuladoTotal: 420, saldo: 430, monto: 50460 }, PLANILLA.lineas[1]],
      subtotal: 50460,
      descuentoAnticipo: 5046,
      retencion: 3532.2,
      neto: 41881.8,
    };
    const { escribir, pulsar, servicio, boton, totales } = montarEditor({ guardar: () => of(guardada) });
    expect(boton('Guardar')!.disabled).toBe(true);
    escribir(0, '120');
    pulsar('Guardar');
    expect(servicio.guardar).toHaveBeenCalledWith('pl1', {
      version: 2,
      lineas: [
        { partidaId: 'p1', cantidadPeriodo: 120 },
        { partidaId: 'p2', cantidadPeriodo: 0 },
      ],
      fotoIds: [],
    });
    expect(totales()).toEqual(['Bs 50.460,00', 'Bs 5.046,00', 'Bs 3.532,20', 'Bs 41.881,80']);
    // Sin cambios pendientes, «Guardar» vuelve a quedar inactivo
    expect(boton('Guardar')!.disabled).toBe(true);
  });

  it('marca las filas que Obras rechaza por superar lo contratado (SUPERA_CANTIDAD_CONTRATADA)', () => {
    const { escribir, pulsar, filas, aviso } = montarEditor({
      guardar: () =>
        throwError(() => errorGraphql('SUPERA_CANTIDAD_CONTRATADA', 422, [{ campo: 'p2', mensaje: 'supera' }])),
    });
    escribir(1, '10');
    pulsar('Guardar');
    expect(filas()[1].classList).toContain('supera');
    expect(aviso()).toBe('Hay filas que superan lo contratado. Corrígelas para guardar.');
  });
});
