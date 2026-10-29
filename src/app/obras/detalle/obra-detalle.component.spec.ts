import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import type { FinanzasObra, Obra } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import { ObraDetalleComponent, anchoBarra, esperandoContrato } from './obra-detalle.component';

const OBRA: Obra = {
  id: 'b1',
  nombre: 'Edificio Las Palmas',
  ubicacion: 'Santa Cruz',
  estado: 'SIN_CONTRATO',
  fechaInicio: '2026-11-01',
  motivoRechazoContrato: null,
  residente: { id: 'r1', nombre: 'Rosa Vaca', correo: null },
  maestro: null,
  almacenero: null,
  cliente: null,
  contrato: { contratoId: null, monto: 357425, plazoDias: 300, anticipoPct: 10, retencionPct: 7 },
  avancePct: 0,
  plazoPct: 0,
  enRiesgo: false,
  partidas: [
    {
      id: 'p1',
      codigo: 'P-01',
      nombre: 'Losa',
      unidad: 'm2',
      cantidadContratada: 850,
      precioUnitario: 420.5,
      meses: null,
      ejecutadaAcumulada: 0,
      avancePct: 0,
    },
  ],
};

/** Obra en ejecución con contrato, asignaciones y avance. */
const EN_EJECUCION: Obra = {
  ...OBRA,
  estado: 'EN_EJECUCION',
  maestro: { id: 'm1', nombre: 'Mario Quispe', correo: null },
  almacenero: { id: 'a1', nombre: 'Juan Rojas', correo: null },
  cliente: { id: 'c1', nombre: 'Inmobiliaria Sur', correo: null },
  contrato: { ...OBRA.contrato, contratoId: 'k1' },
  avancePct: 20,
  plazoPct: 32.5,
  enRiesgo: true,
  partidas: [{ ...OBRA.partidas[0], ejecutadaAcumulada: 212.5, avancePct: 25 }],
};

const FINANZAS: FinanzasObra = { saldoDisponible: 300000, totalCobrado: 57425, totalReservado: 0 };

function montar(
  obtener: (id: string) => Observable<Obra | null>,
  opciones: { roles?: string[]; finanzas?: () => Observable<FinanzasObra | null> } = {},
) {
  window.plataforma = { configuracion: { gatewayUrl: 'http://localhost:4000/graphql' } };
  if (opciones.roles) {
    window.plataforma.sesion = {
      usuario: { id: 'u1', nombre: 'Usuario', roles: opciones.roles },
      obtenerToken: () => Promise.resolve('t'),
      cerrarSesion: () => undefined,
    };
  }
  TestBed.configureTestingModule({
    imports: [ObraDetalleComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'b1' })) } },
      { provide: ObrasService, useValue: { obtener, finanzas: opciones.finanzas ?? (() => of(FINANZAS)) } },
    ],
  });
  const fixture = TestBed.createComponent(ObraDetalleComponent);
  fixture.detectChanges();
  return { fixture, elemento: fixture.nativeElement as HTMLElement };
}

/** Texto visible con un espacio entre elementos (jsdom no tiene innerText). */
function texto(elemento: Element): string {
  const recorrido = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);
  const partes: string[] = [];
  while (recorrido.nextNode()) partes.push(recorrido.currentNode.textContent ?? '');
  return partes.join(' ').replace(/\s+/g, ' ');
}

describe('ObraDetalleComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete window.plataforma;
  });

  it('esperandoContrato: solo SIN_CONTRATO sin motivo', () => {
    expect(esperandoContrato(OBRA)).toBe(true);
    expect(esperandoContrato({ ...OBRA, motivoRechazoContrato: 'x' })).toBe(false);
    expect(esperandoContrato({ ...OBRA, estado: 'EN_EJECUCION' })).toBe(false);
    expect(esperandoContrato(null)).toBe(false);
  });

  it('anchoBarra limita el porcentaje entre 0 y 100', () => {
    expect(anchoBarra(-5)).toBe(0);
    expect(anchoBarra(32.5)).toBe(32.5);
    expect(anchoBarra(130)).toBe(100);
  });

  it('muestra «Registrando contrato…» y consulta cada 2 s hasta EN_EJECUCION (002, criterio 8)', async () => {
    const enEjecucion: Obra = { ...OBRA, estado: 'EN_EJECUCION', contrato: { ...OBRA.contrato, contratoId: 'c1' } };
    const respuestas: Obra[] = [OBRA, OBRA, enEjecucion];
    const obtener = vi.fn(() => of(respuestas.length > 1 ? respuestas.shift()! : respuestas[0]));
    const { fixture, elemento } = montar(obtener);

    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(elemento.textContent).toContain('Registrando contrato…');
    expect(elemento.textContent).toContain('Edificio Las Palmas');
    expect(elemento.textContent).toContain('Rosa Vaca');
    expect(obtener).toHaveBeenCalledWith('b1');

    await vi.advanceTimersByTimeAsync(4000);
    fixture.detectChanges();
    expect(obtener).toHaveBeenCalledTimes(3);
    expect(elemento.textContent).not.toContain('Registrando contrato…');
    expect(elemento.textContent).toContain('En ejecución');

    await vi.advanceTimersByTimeAsync(10000);
    expect(obtener).toHaveBeenCalledTimes(3);
  });

  it('deja de consultar a los 30 s y ofrece «Actualizar»', async () => {
    const obtener = vi.fn(() => of(OBRA));
    const { fixture, elemento } = montar(obtener);
    await vi.advanceTimersByTimeAsync(40000);
    fixture.detectChanges();
    expect(obtener).toHaveBeenCalledTimes(16);
    expect(elemento.textContent).toContain('Registrando contrato…');
    expect([...elemento.querySelectorAll('button')].some((b) => b.textContent?.includes('Actualizar'))).toBe(true);
  });

  it('si Finanzas rechaza el contrato muestra el motivo y deja de consultar (002, criterio 9)', async () => {
    const motivo = 'El anticipo más la retención deben sumar menos de 100 %';
    const obtener = vi.fn(() => of({ ...OBRA, motivoRechazoContrato: motivo }));
    const { fixture, elemento } = montar(obtener);
    await vi.advanceTimersByTimeAsync(6000);
    fixture.detectChanges();
    expect(elemento.textContent).toContain('Contrato rechazado');
    expect(elemento.textContent).toContain(motivo);
    expect(elemento.textContent).not.toContain('Registrando contrato…');
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('OBRA_NO_ENCONTRADA muestra «Obra no encontrada» (criterio 6)', async () => {
    const error = new CombinedGraphQLErrors({
      data: { obra: null },
      errors: [{ message: 'Obra no encontrada', extensions: { codigo: 'OBRA_NO_ENCONTRADA', estado: 404 } }],
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fixture, elemento } = montar(() => throwError(() => error));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(elemento.textContent).toContain('Obra no encontrada');
    expect(elemento.textContent).toContain('Volver a la lista de obras');
  });

  it('una obra que no llega (null sin error) también muestra «Obra no encontrada» (criterio 6)', async () => {
    const { fixture, elemento } = montar(() => of(null));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(elemento.textContent).toContain('Obra no encontrada');
  });

  describe('obra en ejecución (criterio 3)', () => {
    async function abrir(obra: Obra, opciones: Parameters<typeof montar>[1] = {}) {
      const montado = montar(() => of(obra), opciones);
      await vi.advanceTimersByTimeAsync(0);
      montado.fixture.detectChanges();
      return montado;
    }

    it('el encabezado muestra nombre, ubicación, estado, inicio, asignaciones y «En riesgo»', async () => {
      const { elemento } = await abrir(EN_EJECUCION);
      const encabezado = texto(elemento.querySelector('header.encabezado')!);
      expect(encabezado).toContain('Edificio Las Palmas');
      expect(encabezado).toContain('Santa Cruz · Inicio 01/11/2026');
      expect(encabezado).toContain('En ejecución');
      expect(encabezado).toContain('En riesgo');
      expect(encabezado).toContain('Residente Rosa Vaca');
      expect(encabezado).toContain('Maestro de obra Mario Quispe');
      expect(encabezado).toContain('Almacenero Juan Rojas');
      expect(encabezado).toContain('Cliente Inmobiliaria Sur');
    });

    it('sin riesgo no muestra la etiqueta', async () => {
      const { elemento } = await abrir({ ...EN_EJECUCION, enRiesgo: false });
      expect(elemento.textContent).not.toContain('En riesgo');
    });

    it('muestra avance y plazo transcurrido en porcentaje y el contrato', async () => {
      const { elemento } = await abrir(EN_EJECUCION);
      const contenido = texto(elemento);
      expect(contenido).toContain('Avance de la obra 20 %');
      expect(contenido).toContain('Plazo transcurrido 32,5 %');
      const barras = [...elemento.querySelectorAll('[role="progressbar"]')].map((barra) =>
        barra.getAttribute('aria-valuenow'),
      );
      expect(barras).toEqual(['20', '32.5']);
      expect(contenido).toContain('Monto Bs 357.425,00');
      expect(contenido).toContain('Plazo 300 días');
      expect(contenido).toContain('Anticipo 10 %');
      expect(contenido).toContain('Retención 7 %');
    });

    it('la tabla de partidas muestra código, nombre, unidad, contratada, ejecutada, avance y precio', async () => {
      const { elemento } = await abrir(EN_EJECUCION);
      const celdas = [...elemento.querySelectorAll('tr.mat-mdc-row td')].map((celda) => celda.textContent?.trim());
      expect(celdas).toEqual(['P-01', 'Losa', 'm2', '850', '212,5', '25 %', 'Bs 420,50']);
    });

    it.each([['admin'], ['gerente']])('%s ve el saldo disponible y el total cobrado', async (rol) => {
      const finanzas = vi.fn(() => of(FINANZAS));
      const { elemento } = await abrir(EN_EJECUCION, { roles: [rol], finanzas });
      expect(finanzas).toHaveBeenCalledTimes(1);
      expect(texto(elemento)).toContain('Saldo disponible Bs 300.000,00');
      expect(texto(elemento)).toContain('Total cobrado Bs 57.425,00');
    });

    it('residente no pide ni ve las finanzas', async () => {
      const finanzas = vi.fn(() => of(FINANZAS));
      const { elemento } = await abrir(EN_EJECUCION, { roles: ['residente'], finanzas });
      expect(finanzas).not.toHaveBeenCalled();
      expect(elemento.textContent).not.toContain('Saldo disponible');
    });

    it('sin contrato registrado no pide las finanzas', async () => {
      const finanzas = vi.fn(() => of(FINANZAS));
      await abrir({ ...OBRA, motivoRechazoContrato: 'x' }, { roles: ['admin'], finanzas });
      expect(finanzas).not.toHaveBeenCalled();
    });

    it('si Finanzas no responde, solo su parte dice «No disponible por el momento» y se reintenta (criterio 4)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const error = new CombinedGraphQLErrors({
        data: { obra: { id: 'b1', finanzas: null } },
        errors: [{ message: 'x', extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'finanzas', estado: 503 } }],
      });
      const respuestas: Observable<FinanzasObra | null>[] = [throwError(() => error), of(FINANZAS)];
      const finanzas = vi.fn(() => respuestas.shift()!);
      const { fixture, elemento } = await abrir(EN_EJECUCION, { roles: ['admin'], finanzas });
      expect(texto(elemento)).toContain('Saldo y total cobrado: No disponible por el momento.');
      expect(texto(elemento)).toContain('Monto Bs 357.425,00');
      expect(elemento.textContent).toContain('Losa');

      [...elemento.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'))!.click();
      fixture.detectChanges();
      expect(finanzas).toHaveBeenCalledTimes(2);
      expect(texto(elemento)).toContain('Saldo disponible Bs 300.000,00');
      expect(elemento.textContent).not.toContain('No disponible por el momento');
    });
  });
});
