import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { map, of, throwError, type Observable } from 'rxjs';
import { instalarPlataformaFalsa, red, type PlataformaFalsa } from '../../nucleo/plataforma-falsa';
import type { BorradorPlanilla } from '../../nucleo/sesion.service';
import type { Foto } from '../../obras/obras.graphql';
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
  cobro: null,
  fotoIds: [],
};

const errorGraphql = (
  codigo: string,
  estado: number,
  errores: { campo: string; mensaje: string }[] = [],
) =>
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
  fotos?: (obraId: string, periodo: string) => Observable<Foto[]>;
  /** 104: window.plataforma con conexión y almacén en memoria. */
  plataforma?: { enLinea?: boolean; borradores?: BorradorPlanilla[] };
}

function montarEditor(opciones: Opciones = {}) {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const usuario = opciones.usuario ?? { id: 'r1', roles: ['residente'] };
  let plataforma: PlataformaFalsa | undefined;
  if (opciones.plataforma) {
    plataforma = instalarPlataformaFalsa({
      enLinea: opciones.plataforma.enLinea,
      usuario: { ...usuario, nombre: 'Usuario' },
    });
    for (const borrador of opciones.plataforma.borradores ?? []) {
      plataforma.borradores.set(borrador.planillaId, borrador);
    }
  } else {
    window.plataforma = {
      configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
      sesion: {
        usuario: { ...usuario, nombre: 'Usuario' },
        obtenerToken: () => Promise.resolve('t'),
        cerrarSesion: () => undefined,
      },
    };
  }
  const planilla = { ...PLANILLA, ...opciones.planilla };
  const servicio = {
    // Respuestas de la red (104: el servicio devuelve { datos, desdeEquipo, guardadoEn })
    obtener: vi.fn(() => (opciones.obtener ?? (() => of(planilla)))().pipe(map(red))),
    obra: vi.fn(() => of(red(OBRA))),
    guardar: vi.fn(opciones.guardar ?? (() => of(planilla))),
    presentar: vi.fn(opciones.presentar ?? (() => of(planilla))),
    fotosDelPeriodo: vi.fn((obraId: string, periodo: string) =>
      (opciones.fotos ?? (() => of([])))(obraId, periodo).pipe(map(red)),
    ),
  };
  TestBed.configureTestingModule({
    imports: [PlanillaEditorComponent],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: 'pl1' })), parent: null },
      },
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
    [...elemento.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.trim().startsWith(texto),
    );
  const pulsar = (texto: string) => {
    boton(texto)!.click();
    fixture.detectChanges();
  };
  const totales = () =>
    [...elemento.querySelectorAll('.totales dd')].map((celda) => celda.textContent?.trim());
  const filas = () => [...elemento.querySelectorAll('tr.mat-mdc-row')];
  const aviso = () => elemento.querySelector('[role="alert"]')?.textContent?.trim();
  /** Espera las promesas del almacén y vuelve a pintar. */
  const esperar = async () => {
    await new Promise((listo) => setTimeout(listo));
    fixture.detectChanges();
  };
  return {
    fixture,
    elemento,
    servicio,
    entradas,
    escribir,
    boton,
    pulsar,
    totales,
    filas,
    aviso,
    plataforma,
    esperar,
  };
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
      lineas: [
        {
          ...PLANILLA.lineas[0],
          cantidadPeriodo: 120,
          acumuladoTotal: 420,
          saldo: 430,
          monto: 50460,
        },
        PLANILLA.lineas[1],
      ],
      subtotal: 50460,
      descuentoAnticipo: 5046,
      retencion: 3532.2,
      neto: 41881.8,
    };
    const { escribir, pulsar, servicio, boton, totales } = montarEditor({
      guardar: () => of(guardada),
    });
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
        throwError(() =>
          errorGraphql('SUPERA_CANTIDAD_CONTRATADA', 422, [{ campo: 'p2', mensaje: 'supera' }]),
        ),
    });
    escribir(1, '10');
    pulsar('Guardar');
    expect(filas()[1].classList).toContain('supera');
    expect(aviso()).toBe('Hay filas que superan lo contratado. Corrígelas para guardar.');
  });
});

const FOTO = (id: string, registradoEn: string) => ({
  id,
  partidaId: 'p1',
  registradoPor: { id: 'm1', nombre: 'Mario Quispe' },
  registradoEn,
  urlDescarga: `https://s3.example/${id}.jpg`,
});

/** La planilla después de cargar 120 en la losa (como la devuelve Obras). */
const CON_CANTIDAD: Planilla = {
  ...PLANILLA,
  lineas: [
    { ...PLANILLA.lineas[0], cantidadPeriodo: 120, acumuladoTotal: 420, saldo: 430, monto: 50460 },
    PLANILLA.lineas[1],
  ],
  subtotal: 50460,
  descuentoAnticipo: 5046,
  retencion: 3532.2,
  neto: 41881.8,
};

describe('PlanillaEditorComponent (fotos, guardar y presentar)', () => {
  afterEach(() => delete window.plataforma);

  it('muestra las fotos del periodo y adjunta las elegidas al guardar (criterio 6)', () => {
    const { elemento, fixture, servicio, pulsar } = montarEditor({
      planilla: { fotoIds: ['f1'] },
      fotos: () => of([FOTO('f1', '2026-11-20T15:00:00Z'), FOTO('f2', '2026-11-05T15:00:00Z')]),
    });
    expect(servicio.fotosDelPeriodo).toHaveBeenCalledWith('b1', '2026-11');
    const casillas = () => [...elemento.querySelectorAll<HTMLInputElement>('mat-checkbox input')];
    expect(casillas().map((casilla) => casilla.checked)).toEqual([true, false]);
    casillas()[0].click();
    casillas()[1].click();
    fixture.detectChanges();
    pulsar('Guardar');
    expect(servicio.guardar.mock.calls[0][1].fotoIds).toEqual(['f2']);
  });

  it('si la galería no responde, solo esa sección muestra «No disponible por el momento»', () => {
    const { elemento } = montarEditor({ fotos: () => throwError(() => new Error('caído')) });
    expect(elemento.querySelector('app-estado-error')?.textContent).toContain(
      'No disponible por el momento.',
    );
    expect(elemento.querySelectorAll('input[type="number"]').length).toBe(2);
  });

  it('si otra persona guardó antes avisa y «Recargar» trae la última versión (criterio 7)', () => {
    const lecturas: Planilla[] = [PLANILLA, { ...CON_CANTIDAD, version: 5 }];
    const { escribir, pulsar, aviso, servicio, entradas } = montarEditor({
      obtener: () => of(lecturas.shift()!),
      guardar: () => throwError(() => errorGraphql('VERSION_DESACTUALIZADA', 409)),
    });
    escribir(1, '10');
    pulsar('Guardar');
    expect(aviso()).toContain('La planilla cambió, recarga para ver la última versión');
    pulsar('Recargar');
    expect(servicio.obtener).toHaveBeenCalledTimes(2);
    expect(entradas().map((entrada) => entrada.value)).toEqual(['120', '0']);
    expect(aviso()).toBeUndefined();
  });

  it('«Presentar» no se permite con subtotal 0 (criterio 8)', () => {
    const { boton, escribir } = montarEditor();
    expect(boton('Presentar')!.disabled).toBe(true);
    escribir(1, '10');
    expect(boton('Presentar')!.disabled).toBe(false);
    escribir(1, '0');
    expect(boton('Presentar')!.disabled).toBe(true);
  });

  it('«Presentar» presenta la versión guardada y deja la planilla en lectura (criterio 8)', () => {
    const { pulsar, servicio, entradas, elemento } = montarEditor({
      planilla: CON_CANTIDAD,
      presentar: () => of({ ...CON_CANTIDAD, estado: 'PRESENTADA', version: 3 }),
    });
    pulsar('Presentar');
    expect(servicio.guardar).not.toHaveBeenCalled();
    expect(servicio.presentar).toHaveBeenCalledWith('pl1', 2);
    expect(elemento.querySelector('app-estado-chip')?.textContent).toContain('Presentada');
    expect(entradas()).toEqual([]);
  });

  it('con cambios sin guardar, «Presentar» guarda primero y presenta con la versión nueva', () => {
    const { escribir, pulsar, servicio } = montarEditor({
      guardar: () => of({ ...CON_CANTIDAD, version: 3 }),
      presentar: () => of({ ...CON_CANTIDAD, estado: 'PRESENTADA', version: 4 }),
    });
    escribir(0, '120');
    pulsar('Presentar');
    expect(servicio.guardar).toHaveBeenCalledWith('pl1', expect.objectContaining({ version: 2 }));
    expect(servicio.presentar).toHaveBeenCalledWith('pl1', 3);
  });

  it('muestra el motivo si Obras no la deja presentar (SUBTOTAL_CERO)', () => {
    const { pulsar, aviso } = montarEditor({
      planilla: CON_CANTIDAD,
      presentar: () => throwError(() => errorGraphql('SUBTOTAL_CERO', 422)),
    });
    pulsar('Presentar');
    expect(aviso()).toBe(
      'No se puede presentar una planilla con subtotal 0. Indica las cantidades ejecutadas del periodo.',
    );
  });

  it('si ya no es editable la recarga en lectura y dice su estado (PLANILLA_NO_EDITABLE)', () => {
    const lecturas: Planilla[] = [PLANILLA, { ...CON_CANTIDAD, estado: 'PRESENTADA' }];
    const { escribir, pulsar, aviso, entradas } = montarEditor({
      obtener: () => of(lecturas.shift()!),
      guardar: () => throwError(() => errorGraphql('PLANILLA_NO_EDITABLE', 409)),
    });
    escribir(1, '10');
    pulsar('Guardar');
    expect(aviso()).toBe('La planilla ya no se puede editar (estado Presentada)');
    expect(entradas()).toEqual([]);
  });
});

describe('PlanillaEditorComponent (modo lectura)', () => {
  afterEach(() => delete window.plataforma);

  const sinEdicion = (elemento: HTMLElement) => ({
    entradas: elemento.querySelectorAll('input[type="number"]').length,
    botones: [...elemento.querySelectorAll('button')].map((b) => b.textContent?.trim()),
  });

  for (const estado of ['PRESENTADA', 'APROBANDO', 'APROBADA'] as const) {
    it(`una planilla ${estado} ya no se edita, ni para el residente asignado (criterio 9)`, () => {
      const { elemento, totales } = montarEditor({ planilla: { ...CON_CANTIDAD, estado } });
      expect(sinEdicion(elemento)).toEqual({ entradas: 0, botones: [] });
      expect(totales()).toEqual(['Bs 50.460,00', 'Bs 5.046,00', 'Bs 3.532,20', 'Bs 41.881,80']);
    });
  }

  for (const rol of ['admin', 'gerente']) {
    it(`${rol} ve el borrador en modo lectura con lo que devolvió Obras (criterio 10)`, () => {
      const { elemento, filas } = montarEditor({
        usuario: { id: 'u9', roles: [rol] },
        planilla: CON_CANTIDAD,
      });
      expect(sinEdicion(elemento)).toEqual({ entradas: 0, botones: [] });
      const celdas = [...filas()[0].querySelectorAll('td')].map((celda) =>
        celda.textContent?.trim(),
      );
      expect(celdas).toEqual([
        'P-01',
        'Losa',
        'm2',
        '850',
        '300',
        '120',
        '420',
        '430',
        'Bs 50.460,00',
      ]);
    });
  }

  it('otro residente (no asignado) tampoco la edita (criterio 10)', () => {
    const { elemento } = montarEditor({ usuario: { id: 'r2', roles: ['residente'] } });
    expect(sinEdicion(elemento).entradas).toBe(0);
  });

  it('en lectura la galería muestra solo las fotos adjuntas, sin casillas', () => {
    const { elemento } = montarEditor({
      usuario: { id: 'g1', roles: ['gerente'] },
      planilla: { ...CON_CANTIDAD, estado: 'PRESENTADA', fotoIds: ['f2'] },
      fotos: () => of([FOTO('f1', '2026-11-20T15:00:00Z'), FOTO('f2', '2026-11-05T15:00:00Z')]),
    });
    expect(
      [...elemento.querySelectorAll('.galeria img')].map((img) => img.getAttribute('src')),
    ).toEqual(['https://s3.example/f2.jpg']);
    expect(elemento.querySelector('mat-checkbox')).toBeNull();
  });

  it('una OBSERVADA muestra la observación y se corrige y vuelve a presentar (criterio 9)', () => {
    const observada: Planilla = {
      ...CON_CANTIDAD,
      estado: 'OBSERVADA',
      observacion: 'Falta la foto de la losa',
    };
    const { elemento, escribir, pulsar, servicio, boton } = montarEditor({
      planilla: observada,
      guardar: () => of({ ...observada, version: 3 }),
      presentar: () => of({ ...observada, estado: 'PRESENTADA', version: 4 }),
    });
    expect(elemento.querySelector('.observacion')?.textContent).toContain(
      'Falta la foto de la losa',
    );
    expect(sinEdicion(elemento).entradas).toBe(2);
    escribir(0, '100');
    pulsar('Volver a presentar');
    expect(servicio.guardar).toHaveBeenCalled();
    expect(servicio.presentar).toHaveBeenCalledWith('pl1', 3);
    expect(elemento.querySelector('.observacion')).toBeNull();
    expect(boton('Volver a presentar')).toBeUndefined();
  });

  it('una APROBADA muestra el número de cobro (008, criterio 14)', () => {
    const { elemento } = montarEditor({
      planilla: {
        ...CON_CANTIDAD,
        estado: 'APROBADA',
        cobro: { id: 'c1', numero: 'COB-2026-0003' },
      },
    });
    expect(elemento.querySelector('.encabezado .cobro')?.textContent?.trim()).toBe(
      'Cobro COB-2026-0003',
    );
    expect(elemento.querySelector('.observacion')).toBeNull();
  });

  it('sin cobro (todavía no aprobada) no muestra número de cobro', () => {
    const { elemento } = montarEditor({ planilla: { ...CON_CANTIDAD, estado: 'APROBANDO' } });
    expect(elemento.querySelector('.cobro')).toBeNull();
  });

  for (const rol of ['admin', 'gerente']) {
    it(`${rol} ve en lectura el motivo del fallo de la aprobación de una OBSERVADA (008, criterios 6 y 14)`, () => {
      const { elemento } = montarEditor({
        usuario: { id: 'u9', roles: [rol] },
        planilla: {
          ...CON_CANTIDAD,
          estado: 'OBSERVADA',
          observacion: 'Saldo del contrato insuficiente',
        },
      });
      expect(elemento.querySelector('.observacion')?.textContent).toContain(
        'Saldo del contrato insuficiente',
      );
      expect(sinEdicion(elemento)).toEqual({ entradas: 0, botones: [] });
    });
  }

  it('al abrirse vuelve a leer la planilla del gateway para mostrar su estado actual (008)', () => {
    const { servicio, elemento } = montarEditor({
      planilla: { ...CON_CANTIDAD, estado: 'APROBADA' },
    });
    expect(servicio.obtener).toHaveBeenCalledTimes(1);
    expect(servicio.obtener).toHaveBeenCalledWith('pl1');
    expect(elemento.querySelector('app-estado-chip')?.textContent).toContain('Aprobada');
  });

  it('una planilla que no existe o no ve muestra el aviso de no encontrada', () => {
    const { elemento } = montarEditor({ obtener: () => of(null) });
    expect(elemento.textContent).toContain('No encontramos lo que buscas.');
  });
});

describe('PlanillaEditorComponent (borrador local, 104)', () => {
  afterEach(() => delete window.plataforma);

  const borradorLocal = (cambios: Partial<BorradorPlanilla> = {}): BorradorPlanilla => ({
    planillaId: 'pl1',
    obraId: 'b1',
    numero: 3,
    periodo: '2026-11',
    versionBase: 2,
    lineas: [
      { partidaId: 'p1', cantidadPeriodo: 120 },
      { partidaId: 'p2', cantidadPeriodo: 10 },
    ],
    fotoIds: [],
    guardadoEn: '2026-11-15T18:30:00Z',
    estadoEnvio: 'PENDIENTE',
    ...cambios,
  });

  it('sin conexión «Guardar» guarda el borrador en el equipo y deshabilita «Presentar»', async () => {
    const { escribir, pulsar, boton, elemento, servicio, plataforma, esperar } = montarEditor({
      plataforma: { enLinea: false },
    });
    escribir(0, '120');
    expect(boton('Presentar')!.disabled).toBe(true);
    pulsar('Guardar');
    await esperar();

    expect(servicio.guardar).not.toHaveBeenCalled();
    const guardado = plataforma!.borradores.get('pl1')!;
    expect(guardado).toMatchObject({
      obraId: 'b1',
      numero: 3,
      periodo: '2026-11',
      versionBase: 2,
      estadoEnvio: 'PENDIENTE',
      lineas: [
        { partidaId: 'p1', cantidadPeriodo: 120 },
        { partidaId: 'p2', cantidadPeriodo: 0 },
      ],
    });
    expect(elemento.textContent).toContain(
      'Guardado en este equipo; se enviará al volver la conexión',
    );
    expect(elemento.textContent).toContain('Borrador local sin enviar');
  });

  it('si el envío falla por la red, guarda el borrador en el equipo y avisa al shell', async () => {
    const { escribir, pulsar, elemento, plataforma, esperar } = montarEditor({
      plataforma: { enLinea: true },
      guardar: () => throwError(() => new TypeError('Failed to fetch')),
    });
    escribir(1, '5');
    pulsar('Guardar');
    await esperar();

    expect(plataforma!.fallosReportados).toBe(1);
    expect(plataforma!.borradores.get('pl1')?.lineas[1].cantidadPeriodo).toBe(5);
    expect(elemento.textContent).toContain(
      'Guardado en este equipo; se enviará al volver la conexión',
    );
  });

  it('al abrir una planilla con borrador muestra sus cantidades y «Borrador local sin enviar (guardado dd/mm hh:mm)»', async () => {
    const { entradas, totales, elemento, boton, esperar } = montarEditor({
      plataforma: { enLinea: true, borradores: [borradorLocal()] },
    });
    await esperar();

    expect(entradas().map((entrada) => entrada.value)).toEqual(['120', '10']);
    expect(totales()[0]).toBe('Bs 51.460,00');
    expect(elemento.textContent).toContain('Borrador local sin enviar (guardado 15/11 14:30)');
    expect(boton('Presentar')!.disabled).toBe(true);
  });

  it('un borrador rechazado marca las filas con los errores de Obras', async () => {
    const { filas, elemento, esperar } = montarEditor({
      plataforma: {
        borradores: [
          borradorLocal({
            estadoEnvio: 'RECHAZADO',
            ultimoError: {
              codigo: 'SUPERA_CANTIDAD_CONTRATADA',
              mensaje: 'Hay filas que superan lo contratado. Corrígelas para guardar.',
              errores: [{ campo: 'p2', mensaje: 'supera' }],
            },
          }),
        ],
      },
    });
    await esperar();
    expect(filas()[1].classList).toContain('supera');
    expect(elemento.textContent).toContain('Hay filas que superan lo contratado.');
  });

  it('guardar con conexión borra el borrador local', async () => {
    const { escribir, pulsar, plataforma, elemento, esperar } = montarEditor({
      plataforma: { borradores: [borradorLocal()] },
      guardar: (_id, entrada) =>
        of({
          ...PLANILLA,
          version: 3,
          lineas: PLANILLA.lineas.map((linea, i) => ({
            ...linea,
            cantidadPeriodo: entrada.lineas[i].cantidadPeriodo,
          })),
        }),
    });
    await esperar();
    escribir(0, '100');
    pulsar('Guardar');
    await esperar();

    expect(plataforma!.borradores.has('pl1')).toBe(false);
    expect(elemento.textContent).not.toContain('Borrador local sin enviar');
  });
});
