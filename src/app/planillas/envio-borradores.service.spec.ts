import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { of, throwError, type Observable } from 'rxjs';
import { instalarPlataformaFalsa, type PlataformaFalsa } from '../nucleo/plataforma-falsa';
import type { BorradorPlanilla } from '../nucleo/sesion.service';
import {
  avisoBorradorEnviado,
  EnvioBorradoresService,
  INTERVALO_ENVIO_MS,
} from './envio-borradores.service';
import type { GuardarPlanillaEntrada } from './planillas.graphql';
import { PlanillasService } from './planillas.service';

const BORRADOR: BorradorPlanilla = {
  planillaId: 'pl1',
  obraId: 'b1',
  numero: 3,
  periodo: '2026-11',
  versionBase: 2,
  lineas: [{ partidaId: 'p1', cantidadPeriodo: 120 }],
  fotoIds: ['f1'],
  guardadoEn: '2026-11-15T18:30:00Z',
  estadoEnvio: 'PENDIENTE',
};

const errorGraphql = (codigo: string, errores: { campo: string; mensaje: string }[] = []) =>
  new CombinedGraphQLErrors({
    errors: [{ message: codigo, extensions: { codigo, estado: 409, errores } }],
  });

describe('EnvioBorradoresService (104)', () => {
  let plataforma: PlataformaFalsa;
  let guardar: ReturnType<
    typeof vi.fn<(id: string, entrada: GuardarPlanillaEntrada) => Observable<unknown>>
  >;
  let obtener: ReturnType<typeof vi.fn>;
  let avisos: string[];

  function crear(opciones: { enLinea?: boolean; borradores?: BorradorPlanilla[] } = {}) {
    plataforma = instalarPlataformaFalsa({ enLinea: opciones.enLinea ?? false });
    for (const borrador of opciones.borradores ?? [BORRADOR]) {
      plataforma.borradores.set(borrador.planillaId, borrador);
    }
    TestBed.configureTestingModule({
      providers: [
        EnvioBorradoresService,
        { provide: PlanillasService, useValue: { guardar, obtener } },
        { provide: MatSnackBar, useValue: { open: (texto: string) => avisos.push(texto) } },
      ],
    });
    return TestBed.inject(EnvioBorradoresService);
  }

  /** Vuelve la conexión y espera a que termine el envío. */
  async function volverConexion() {
    plataforma.cambiarConexion(true);
    await vi.waitFor(() => expect(guardar).toHaveBeenCalled());
    await new Promise((listo) => setTimeout(listo));
  }

  beforeEach(() => {
    guardar = vi.fn(() => of({}));
    obtener = vi.fn();
    avisos = [];
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    window.plataforma = undefined;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('al volver la conexión envía el borrador con su versión, lo borra y avisa', async () => {
    crear();
    await volverConexion();

    expect(guardar).toHaveBeenCalledWith('pl1', {
      version: 2,
      lineas: [{ partidaId: 'p1', cantidadPeriodo: 120 }],
      fotoIds: ['f1'],
    });
    expect(plataforma.borradores.has('pl1')).toBe(false);
    expect(avisos).toEqual([avisoBorradorEnviado(3)]);
    expect(avisos[0]).toBe('Borrador de la planilla N.º 3 enviado');
  });

  it('con VERSION_DESACTUALIZADA lo deja en CONFLICTO sin pisar la planilla', async () => {
    guardar = vi.fn(() => throwError(() => errorGraphql('VERSION_DESACTUALIZADA')));
    crear();
    await volverConexion();
    expect(plataforma.borradores.get('pl1')?.estadoEnvio).toBe('CONFLICTO');
  });

  it('con PLANILLA_NO_EDITABLE lo deja en NO_EDITABLE', async () => {
    guardar = vi.fn(() => throwError(() => errorGraphql('PLANILLA_NO_EDITABLE')));
    crear();
    await volverConexion();
    expect(plataforma.borradores.get('pl1')?.estadoEnvio).toBe('NO_EDITABLE');
  });

  it('con un error de validación lo deja RECHAZADO con los errores', async () => {
    guardar = vi.fn(() =>
      throwError(() =>
        errorGraphql('SUPERA_CANTIDAD_CONTRATADA', [{ campo: 'p1', mensaje: 'supera' }]),
      ),
    );
    crear();
    await volverConexion();
    expect(plataforma.borradores.get('pl1')).toMatchObject({
      estadoEnvio: 'RECHAZADO',
      ultimoError: {
        codigo: 'SUPERA_CANTIDAD_CONTRATADA',
        mensaje: 'Hay filas que superan lo contratado. Corrígelas para guardar.',
        errores: [{ campo: 'p1', mensaje: 'supera' }],
      },
    });
  });

  it('si falla la red queda PENDIENTE y avisa al shell', async () => {
    guardar = vi.fn(() => throwError(() => new TypeError('Failed to fetch')));
    crear();
    await volverConexion();
    expect(plataforma.borradores.get('pl1')?.estadoEnvio).toBe('PENDIENTE');
    expect(plataforma.fallosReportados).toBe(1);
  });

  it('no envía en «modo sin conexión» del shell (sin token)', async () => {
    crear({ enLinea: true });
    window.plataforma!.sesion!.sinConexion = true;
    await TestBed.inject(EnvioBorradoresService).enviarPendientes();
    expect(guardar).not.toHaveBeenCalled();
  });

  it('solo envía los PENDIENTE y reintenta cada 60 s mientras haya conexión', async () => {
    vi.useFakeTimers();
    guardar = vi.fn(() => throwError(() => errorGraphql('ERROR_INTERNO')));
    crear({
      enLinea: true,
      borradores: [BORRADOR, { ...BORRADOR, planillaId: 'pl2', estadoEnvio: 'CONFLICTO' }],
    });
    await vi.advanceTimersByTimeAsync(INTERVALO_ENVIO_MS);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith('pl1', expect.anything());
    await vi.advanceTimersByTimeAsync(INTERVALO_ENVIO_MS);
    expect(guardar).toHaveBeenCalledTimes(2);
  });

  it('«Aplicar mi borrador sobre la última versión» reenvía con la versión nueva', async () => {
    obtener = vi.fn(() =>
      of({ datos: { id: 'pl1', version: 5 }, desdeEquipo: false, guardadoEn: null }),
    );
    const servicio = crear({
      enLinea: true,
      borradores: [{ ...BORRADOR, estadoEnvio: 'CONFLICTO' }],
    });

    expect(await servicio.aplicarSobreUltimaVersion('pl1')).toBe('enviado');
    expect(guardar).toHaveBeenCalledWith('pl1', expect.objectContaining({ version: 5 }));
    expect(plataforma.borradores.has('pl1')).toBe(false);
  });
});
