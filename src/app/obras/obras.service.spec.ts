import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { firstValueFrom } from 'rxjs';
import { CONSULTA_MATERIAL_COMPARADO, CONSULTA_OBRA, CONSULTA_OBRAS } from './obras.graphql';
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
    const respuesta = firstValueFrom(servicio.listar({ estado: 'EN_EJECUCION', busqueda: 'Palmas' }));
    const operacion = gateway.expectOne(CONSULTA_OBRAS);
    expect(operacion.operation.variables).toEqual({ estado: 'EN_EJECUCION', busqueda: 'Palmas' });
    operacion.flushData({ obras: [] });
    expect(await respuesta).toEqual([]);
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
    const obra = await respuesta;
    expect(obra?.nombre).toBe('Edificio Las Palmas');
    expect(obra?.residente?.nombre).toBe('Rosa Vaca');
    expect(obra?.maestro).toBeNull();
  });

  it('obtener entrega el error cuando la obra no llega (OBRA_NO_ENCONTRADA, criterio 6)', async () => {
    const respuesta = firstValueFrom(servicio.obtener('b9'));
    gateway.expectOne(CONSULTA_OBRA).flush({
      data: { obra: null },
      errors: [{ message: 'Obra no encontrada', path: ['obra'], extensions: { codigo: 'OBRA_NO_ENCONTRADA', estado: 404 } }],
    });
    const error = await respuesta.catch((e: unknown) => e);
    expect(CombinedGraphQLErrors.is(error)).toBe(true);
    expect((error as CombinedGraphQLErrors).errors[0].extensions?.['codigo']).toBe('OBRA_NO_ENCONTRADA');
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
});
