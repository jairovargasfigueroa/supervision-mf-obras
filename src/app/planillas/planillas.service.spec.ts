import { TestBed } from '@angular/core/testing';
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { firstValueFrom } from 'rxjs';
import { MUTACION_CREAR_PLANILLA } from './planillas.graphql';
import { PlanillasService } from './planillas.service';

/** Planilla como la devuelve el gateway (con __typename, como la escribe la caché). */
function planillaDelGateway(cambios: Record<string, unknown> = {}) {
  return {
    __typename: 'Planilla',
    id: 'pl1',
    obraId: 'b1',
    numero: 1,
    periodo: '2026-11',
    estado: 'BORRADOR',
    version: 0,
    lineas: [],
    subtotal: 0,
    descuentoAnticipo: 0,
    retencion: 0,
    neto: 0,
    anticipoPct: 10,
    retencionPct: 7,
    observacion: null,
    fotoIds: [],
    ...cambios,
  };
}

describe('PlanillasService', () => {
  let servicio: PlanillasService;
  let gateway: ApolloTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ApolloTestingModule], providers: [PlanillasService] });
    servicio = TestBed.inject(PlanillasService);
    gateway = TestBed.inject(ApolloTestingController);
  });

  afterEach(() => gateway.verify());

  it('crear manda la obra y el periodo y devuelve la planilla en BORRADOR (criterio 1)', async () => {
    const respuesta = firstValueFrom(servicio.crear('b1', '2026-11'));
    const operacion = gateway.expectOne(MUTACION_CREAR_PLANILLA);
    expect(operacion.operation.variables).toEqual({ obraId: 'b1', periodo: '2026-11' });
    operacion.flushData({ crearPlanilla: planillaDelGateway() });
    expect(await respuesta).toMatchObject({ id: 'pl1', estado: 'BORRADOR', numero: 1 });
  });
});
