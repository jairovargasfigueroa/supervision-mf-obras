import { TestBed } from '@angular/core/testing';
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { firstValueFrom } from 'rxjs';
import { CONSULTA_FOTOS } from '../obras/obras.graphql';
import { CONSULTA_PLANILLA, MUTACION_CREAR_PLANILLA } from './planillas.graphql';
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
    cobro: null,
    fotoIds: [],
    ...cambios,
  };
}

describe('PlanillasService', () => {
  let servicio: PlanillasService;
  let gateway: ApolloTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ApolloTestingModule],
      providers: [PlanillasService],
    });
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

  it('obtener pide siempre al gateway (no a la caché) para ver el estado y el cobro actuales (008)', async () => {
    const aprobada = planillaDelGateway({
      estado: 'APROBADA',
      cobro: { __typename: 'CobroPlanilla', id: 'c1', numero: 'COB-2026-0003' },
    });
    const primera = firstValueFrom(servicio.obtener('pl1'));
    gateway
      .expectOne(CONSULTA_PLANILLA)
      .flushData({ planilla: planillaDelGateway({ estado: 'APROBANDO' }) });
    expect((await primera)?.datos).toMatchObject({ estado: 'APROBANDO', cobro: null });

    const segunda = firstValueFrom(servicio.obtener('pl1'));
    const operacion = gateway.expectOne(CONSULTA_PLANILLA);
    expect(operacion.operation.variables).toEqual({ id: 'pl1' });
    operacion.flushData({ planilla: aprobada });
    expect((await segunda)?.datos).toMatchObject({
      estado: 'APROBADA',
      cobro: { id: 'c1', numero: 'COB-2026-0003' },
    });
  });
});

describe('PlanillasService.fotosDelPeriodo', () => {
  let servicio: PlanillasService;
  let gateway: ApolloTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ApolloTestingModule],
      providers: [PlanillasService],
    });
    servicio = TestBed.inject(PlanillasService);
    gateway = TestBed.inject(ApolloTestingController);
  });

  afterEach(() => gateway.verify());

  const foto = (id: string, registradoEn: string) => ({
    __typename: 'Foto',
    id,
    partidaId: 'p1',
    registradoPor: null,
    registradoEn,
    urlDescarga: `https://s3.example/${id}.jpg`,
  });
  const pagina = (numero: number, items: ReturnType<typeof foto>[], total: number) => ({
    obra: {
      __typename: 'Obra',
      id: 'b1',
      fotos: { __typename: 'FotosPagina', items, total, pagina: numero, tamano: 2 },
    },
  });

  it('pide páginas hasta pasar el inicio del periodo y deja solo las del mes en La Paz (criterio 6)', async () => {
    const respuesta = firstValueFrom(servicio.fotosDelPeriodo('b1', '2026-11'));
    const primera = gateway.expectOne(CONSULTA_FOTOS);
    expect(primera.operation.variables).toEqual({ id: 'b1', pagina: 1, tamano: 100 });
    // 1 de diciembre a las 02:00 UTC todavía es 30 de noviembre en La Paz
    primera.flushData(
      pagina(1, [foto('f3', '2026-12-02T15:00:00Z'), foto('f2', '2026-12-01T02:00:00Z')], 6),
    );
    await new Promise((listo) => setTimeout(listo));
    const segunda = gateway.expectOne(CONSULTA_FOTOS);
    expect(segunda.operation.variables).toEqual({ id: 'b1', pagina: 2, tamano: 100 });
    segunda.flushData(
      pagina(2, [foto('f1', '2026-11-03T15:00:00Z'), foto('f0', '2026-10-30T15:00:00Z')], 6),
    );
    // f0 ya es de octubre: no se pide la página 3
    expect((await respuesta)?.datos.map((f) => f.id)).toEqual(['f2', 'f1']);
  });
});
