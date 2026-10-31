import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { print } from 'graphql';
import { firstValueFrom } from 'rxjs';
import {
  CONSULTA_CONSUMOS_ATIPICOS,
  CONSULTA_MATERIAL_COMPARADO,
  CONSULTA_OBRA,
  CONSULTA_OBRAS,
  MUTACION_REVISAR_CONSUMO_ATIPICO,
} from './obras.graphql';
import { instalarPlataformaFalsa, type PlataformaFalsa } from '../nucleo/plataforma-falsa';
import { ObrasService } from './obras.service';

/** Respuesta del gateway para la consulta principal del detalle (con __typename, como la escribe la caché). */
function obraDelGateway(cambios: Record<string, unknown> = {}) {
  return {
    __typename: 'Obra',
    id: 'b1',
    nombre: 'Edificio Las Palmas',
    ubicacion: 'Santa Cruz',
    estado: 'EN_EJECUCION',
    fechaInicio: '2026-11-01',
    motivoRechazoContrato: null,
    residente: { __typename: 'Usuario', id: 'r1', nombre: 'Rosa Vaca', correo: null },
    maestro: null,
    almacenero: null,
    cliente: null,
    contrato: {
      __typename: 'ContratoObra',
      contratoId: 'k1',
      monto: 357425,
      plazoDias: 300,
      anticipoPct: 10,
      retencionPct: 7,
    },
    avancePct: 20,
    plazoPct: 32.5,
    enRiesgo: true,
    partidas: [],
    ...cambios,
  };
}

describe('ObrasService', () => {
  let servicio: ObrasService;
  let gateway: ApolloTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ApolloTestingModule], providers: [ObrasService] });
    servicio = TestBed.inject(ObrasService);
    gateway = TestBed.inject(ApolloTestingController);
  });

  afterEach(() => gateway.verify());

  it('listar manda los filtros de estado y búsqueda (criterio 2)', async () => {
    const respuesta = firstValueFrom(
      servicio.listar({ estado: 'EN_EJECUCION', busqueda: 'Palmas' }),
    );
    const operacion = gateway.expectOne(CONSULTA_OBRAS);
    expect(operacion.operation.variables).toEqual({ estado: 'EN_EJECUCION', busqueda: 'Palmas' });
    operacion.flushData({ obras: [] });
    expect((await respuesta)?.datos).toEqual([]);
  });

  it('obtener muestra la obra aunque un campo secundario llegue con error (respuesta parcial, criterio 4)', async () => {
    const respuesta = firstValueFrom(servicio.obtener('b1'));
    gateway.expectOne(CONSULTA_OBRA).flush({
      data: { obra: obraDelGateway({ maestro: null }) },
      errors: [
        {
          message: 'Keycloak no responde',
          path: ['obra', 'maestro'],
          extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'keycloak', estado: 503 },
        },
      ],
    });
    const obra = (await respuesta)?.datos;
    expect(obra?.nombre).toBe('Edificio Las Palmas');
    expect(obra?.residente?.nombre).toBe('Rosa Vaca');
    expect(obra?.maestro).toBeNull();
  });

  it('obtener pide el riesgo del modelo y, si IA no responde, entrega la obra con el riesgo en null (402, criterio 12)', async () => {
    const respuesta = firstValueFrom(servicio.obtener('b1'));
    const operacion = gateway.expectOne(CONSULTA_OBRA);
    expect(print(operacion.operation.query)).toContain('riesgoRetraso');
    operacion.flush({
      data: { obra: obraDelGateway({ zona: null, riesgoRetraso: null }) },
      errors: [
        {
          message: 'IA no responde',
          path: ['obra', 'riesgoRetraso'],
          extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'ia', estado: 503 },
        },
      ],
    });
    const obra = (await respuesta)?.datos;
    expect(obra?.nombre).toBe('Edificio Las Palmas');
    expect(obra?.riesgoRetraso).toBeNull();
  });

  it('obtener entrega el error cuando la obra no llega (OBRA_NO_ENCONTRADA, criterio 6)', async () => {
    const respuesta = firstValueFrom(servicio.obtener('b9'));
    gateway.expectOne(CONSULTA_OBRA).flush({
      data: { obra: null },
      errors: [
        {
          message: 'Obra no encontrada',
          path: ['obra'],
          extensions: { codigo: 'OBRA_NO_ENCONTRADA', estado: 404 },
        },
      ],
    });
    const error = await respuesta.catch((e: unknown) => e);
    expect(CombinedGraphQLErrors.is(error)).toBe(true);
    expect((error as CombinedGraphQLErrors).errors[0].extensions?.['codigo']).toBe(
      'OBRA_NO_ENCONTRADA',
    );
  });

  it('materialComparado pide el periodo y entrega el error si el servicio no responde', async () => {
    const respuesta = firstValueFrom(servicio.materialComparado('b1', '2026-11'));
    const operacion = gateway.expectOne(CONSULTA_MATERIAL_COMPARADO);
    expect(operacion.operation.variables).toEqual({ id: 'b1', periodo: '2026-11' });
    operacion.flush({
      data: { obra: { __typename: 'Obra', id: 'b1', materialComparado: null } },
      errors: [
        {
          message: 'Materiales no responde',
          path: ['obra', 'materialComparado'],
          extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'materiales', estado: 503 },
        },
      ],
    });
    const error = await respuesta.catch((e: unknown) => e);
    expect(CombinedGraphQLErrors.is(error)).toBe(true);
  });

  describe('consumos atípicos (403)', () => {
    it('pide el estado elegido y, con «Todos», ninguno', async () => {
      const pendientes = firstValueFrom(servicio.consumosAtipicos('b1', 'PENDIENTE'));
      const primera = gateway.expectOne(CONSULTA_CONSUMOS_ATIPICOS);
      expect(primera.operation.variables).toEqual({ id: 'b1', estado: 'PENDIENTE' });
      expect(print(primera.operation.query)).toContain('consumosAtipicos(estado: $estado)');
      primera.flushData({ obra: { __typename: 'Obra', id: 'b1', consumosAtipicos: [] } });
      expect((await pendientes)?.datos).toEqual([]);

      const todos = firstValueFrom(servicio.consumosAtipicos('b1', null));
      const segunda = gateway.expectOne(CONSULTA_CONSUMOS_ATIPICOS);
      expect(segunda.operation.variables).toEqual({ id: 'b1' });
      segunda.flushData({ obra: { __typename: 'Obra', id: 'b1', consumosAtipicos: [] } });
      await todos;
    });

    it('si IA no responde entrega el error (la sección muestra «—»)', async () => {
      const respuesta = firstValueFrom(servicio.consumosAtipicos('b1', 'PENDIENTE'));
      gateway.expectOne(CONSULTA_CONSUMOS_ATIPICOS).flush({
        data: { obra: { __typename: 'Obra', id: 'b1', consumosAtipicos: null } },
        errors: [
          {
            message: 'IA no responde',
            path: ['obra', 'consumosAtipicos'],
            extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'ia', estado: 503 },
          },
        ],
      });
      await expect(respuesta).rejects.toSatisfy(CombinedGraphQLErrors.is);
    });

    it('revisarConsumoAtipico manda el comentario solo si se escribió', () => {
      servicio.revisarConsumoAtipico('c1', 'NORMAL', null).subscribe();
      expect(gateway.expectOne(MUTACION_REVISAR_CONSUMO_ATIPICO).operation.variables).toEqual({
        id: 'c1',
        estado: 'NORMAL',
      });
      servicio.revisarConsumoAtipico('c1', 'CONFIRMADO', 'Se usó en otra obra').subscribe();
      expect(gateway.expectOne(MUTACION_REVISAR_CONSUMO_ATIPICO).operation.variables).toEqual({
        id: 'c1',
        estado: 'CONFIRMADO',
        comentario: 'Se usó en otra obra',
      });
    });
  });

  describe('con respaldo en el equipo (104)', () => {
    let plataforma: PlataformaFalsa;

    beforeEach(() => {
      plataforma = instalarPlataformaFalsa();
    });

    afterEach(() => {
      window.plataforma = undefined;
    });

    it('guarda la obra completa con la clave de la consulta y la devuelve sin conexión', async () => {
      const enLinea = firstValueFrom(servicio.obtener('b1'));
      gateway.expectOne(CONSULTA_OBRA).flushData({ obra: obraDelGateway() });
      expect((await enLinea)?.desdeEquipo).toBe(false);
      await new Promise((listo) => setTimeout(listo));
      expect(plataforma.consultas.has('Obra:{"id":"b1"}')).toBe(true);

      plataforma.cambiarConexion(false);
      const sinConexion = await firstValueFrom(servicio.obtener('b1'));
      expect(sinConexion?.desdeEquipo).toBe(true);
      expect(sinConexion?.datos?.nombre).toBe('Edificio Las Palmas');
    });

    it('no guarda una obra que llegó con un campo caído (respuesta parcial)', async () => {
      const respuesta = firstValueFrom(servicio.obtener('b1'));
      gateway.expectOne(CONSULTA_OBRA).flush({
        data: { obra: obraDelGateway() },
        errors: [
          {
            message: 'Keycloak no responde',
            path: ['obra', 'maestro'],
            extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', estado: 503 },
          },
        ],
      });
      expect((await respuesta)?.datos?.nombre).toBe('Edificio Las Palmas');
      await new Promise((listo) => setTimeout(listo));
      expect(plataforma.consultas.size).toBe(0);
    });

    it('si el gateway no responde, muestra la lista guardada y avisa al shell', async () => {
      plataforma.consultas.set('Obras:{}', {
        datos: [{ id: 'b1' }],
        guardadoEn: '2026-11-15T18:30:00Z',
      });
      const respuesta = firstValueFrom(servicio.listar());
      gateway.expectOne(CONSULTA_OBRAS).networkError(new TypeError('Failed to fetch'));
      expect(await respuesta).toEqual({
        datos: [{ id: 'b1' }],
        desdeEquipo: true,
        guardadoEn: '2026-11-15T18:30:00Z',
      });
      expect(plataforma.fallosReportados).toBe(1);
    });
  });
});
