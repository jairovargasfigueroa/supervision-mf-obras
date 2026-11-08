import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { gql } from 'apollo-angular';
import { firstValueFrom, of, throwError } from 'rxjs';
import { instalarPlataformaFalsa, type PlataformaFalsa } from './plataforma-falsa';
import { claveConsulta, RespaldoService } from './respaldo.service';

const CONSULTA = gql`
  query Obras($estado: EstadoObra) {
    obras(estado: $estado) {
      id
    }
  }
`;

describe('RespaldoService (consultaConRespaldo, 104)', () => {
  let plataforma: PlataformaFalsa;
  let respaldo: RespaldoService;

  function crear(opciones: Parameters<typeof instalarPlataformaFalsa>[0] = {}) {
    plataforma = instalarPlataformaFalsa(opciones);
    respaldo = TestBed.inject(RespaldoService);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    window.plataforma = undefined;
  });

  it('arma la clave con el nombre de la operación y las variables', () => {
    expect(claveConsulta(CONSULTA, { estado: 'EN_EJECUCION' })).toBe(
      'Obras:{"estado":"EN_EJECUCION"}',
    );
  });

  it('en línea ejecuta la consulta, la guarda y la devuelve desde la red', async () => {
    crear();
    const resultado = await firstValueFrom(
      respaldo.consultaConRespaldo('obras:{}', () => of({ datos: ['obra-1'], completa: true })),
    );
    expect(resultado).toEqual({ datos: ['obra-1'], desdeEquipo: false, guardadoEn: null });
    expect(plataforma.consultas.get('obras:{}')?.datos).toEqual(['obra-1']);
  });

  it('no guarda una respuesta parcial, pero la muestra', async () => {
    crear();
    plataforma.consultas.set('obra:{}', {
      datos: 'completa',
      guardadoEn: '2026-10-30T12:00:00.000Z',
    });
    const resultado = await firstValueFrom(
      respaldo.consultaConRespaldo('obra:{}', () => of({ datos: 'parcial', completa: false })),
    );
    expect(resultado?.datos).toBe('parcial');
    expect(plataforma.consultas.get('obra:{}')?.datos).toBe('completa');
  });

  it('ante un error de red reporta el fallo y devuelve lo guardado con su fecha', async () => {
    crear();
    plataforma.consultas.set('obras:{}', {
      datos: ['guardada'],
      guardadoEn: '2026-10-30T12:00:00.000Z',
    });
    const resultado = await firstValueFrom(
      respaldo.consultaConRespaldo('obras:{}', () =>
        throwError(() => new TypeError('Failed to fetch')),
      ),
    );
    expect(resultado).toEqual({
      datos: ['guardada'],
      desdeEquipo: true,
      guardadoEn: '2026-10-30T12:00:00.000Z',
    });
    expect(plataforma.fallosReportados).toBe(1);
  });

  it('sin conexión lee lo guardado sin ejecutar la consulta', async () => {
    crear({ enLinea: false });
    plataforma.consultas.set('obras:{}', {
      datos: ['guardada'],
      guardadoEn: '2026-10-30T12:00:00.000Z',
    });
    let ejecutada = false;
    const resultado = await firstValueFrom(
      respaldo.consultaConRespaldo('obras:{}', () => {
        ejecutada = true;
        return of({ datos: ['red'], completa: true });
      }),
    );
    expect(ejecutada).toBe(false);
    expect(resultado?.desdeEquipo).toBe(true);
  });

  it('sin conexión y sin nada guardado devuelve null', async () => {
    crear({ enLinea: false });
    const resultado = await firstValueFrom(
      respaldo.consultaConRespaldo('nunca:{}', () => of({ datos: 1, completa: true })),
    );
    expect(resultado).toBeNull();
  });

  it('un error del negocio no cae a lo guardado', async () => {
    crear();
    plataforma.consultas.set('obra:{}', {
      datos: 'guardada',
      guardadoEn: '2026-10-30T12:00:00.000Z',
    });
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Obra no encontrada',
          extensions: { codigo: 'OBRA_NO_ENCONTRADA', estado: 404 },
        },
      ],
    });
    await expect(
      firstValueFrom(respaldo.consultaConRespaldo('obra:{}', () => throwError(() => error))),
    ).rejects.toBe(error);
    expect(plataforma.fallosReportados).toBe(0);
  });

  it('sin el almacén del shell solo ejecuta la consulta', async () => {
    crear({ sinAlmacen: true });
    const resultado = await firstValueFrom(
      respaldo.consultaConRespaldo('obras:{}', () => of({ datos: ['red'], completa: true })),
    );
    expect(resultado).toEqual({ datos: ['red'], desdeEquipo: false, guardadoEn: null });
  });
});
