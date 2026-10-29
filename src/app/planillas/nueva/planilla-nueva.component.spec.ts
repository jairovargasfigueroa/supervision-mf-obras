import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { periodoActual } from '../../nucleo/periodos';
import type { PlanillaResumen } from '../../obras/obras.graphql';
import { ObrasService } from '../../obras/obras.service';
import type { ObraDePlanilla, Planilla } from '../planillas.graphql';
import { PlanillasService } from '../planillas.service';
import { PlanillaNuevaComponent, esResidenteAsignado } from './planilla-nueva.component';

const OBRA: ObraDePlanilla = {
  id: 'b1',
  nombre: 'Edificio Las Palmas',
  estado: 'EN_EJECUCION',
  fechaInicio: '2026-01-15',
  residente: { id: 'r1', nombre: 'Rosa Vaca' },
};

const errorGraphql = (codigo: string, estado: number) =>
  new CombinedGraphQLErrors({ data: null, errors: [{ message: 'x', extensions: { codigo, estado, servicio: 'obras' } }] });

interface Opciones {
  usuario?: { id: string; roles: string[] };
  obra?: ObraDePlanilla | null;
  planillas?: PlanillaResumen[];
  crear?: (obraId: string, periodo: string) => Observable<Planilla>;
}

function montar(opciones: Opciones = {}) {
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
  const crear = vi.fn(opciones.crear ?? (() => of({ id: 'pl9' } as Planilla)));
  TestBed.configureTestingModule({
    imports: [PlanillaNuevaComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'b1' })), parent: null } },
      { provide: PlanillasService, useValue: { obra: () => of(opciones.obra === undefined ? OBRA : opciones.obra), crear } },
      { provide: ObrasService, useValue: { planillas: () => of(opciones.planillas ?? []) } },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PlanillaNuevaComponent);
  fixture.detectChanges();
  const elemento = fixture.nativeElement as HTMLElement;
  const pulsarCrear = () => {
    [...elemento.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear planilla'))!.click();
    fixture.detectChanges();
  };
  return { fixture, elemento, crear, navegar, pulsarCrear };
}

describe('esResidenteAsignado', () => {
  it('solo el residente asignado a la obra (criterio 10)', () => {
    expect(esResidenteAsignado(OBRA, { id: 'r1', roles: ['residente'] })).toBe(true);
    expect(esResidenteAsignado(OBRA, { id: 'r2', roles: ['residente'] })).toBe(false);
    expect(esResidenteAsignado(OBRA, { id: 'r1', roles: ['admin'] })).toBe(false);
    expect(esResidenteAsignado({ residente: null }, { id: 'r1', roles: ['residente'] })).toBe(false);
  });
});

describe('PlanillaNuevaComponent', () => {
  afterEach(() => delete window.plataforma);

  it('crea la planilla del mes elegido (por defecto el actual) y abre el editor (criterio 1)', () => {
    const { crear, navegar, pulsarCrear } = montar();
    pulsarCrear();
    expect(crear).toHaveBeenCalledWith('b1', periodoActual());
    expect(navegar).toHaveBeenCalledWith(['planillas', 'pl9'], { relativeTo: null });
  });

  it('ofrece los meses desde el inicio de la obra hasta el actual', () => {
    const { fixture, elemento } = montar({ obra: { ...OBRA, fechaInicio: `${periodoActual()}-01` } });
    elemento.querySelector<HTMLElement>('mat-select')!.click();
    fixture.detectChanges();
    expect(document.querySelectorAll('mat-option').length).toBe(1);
  });

  it('explica cada motivo de rechazo con su texto (criterio 2)', () => {
    const respuestas = [
      errorGraphql('PLANILLA_ABIERTA_EXISTE', 409),
      errorGraphql('PERIODO_NO_POSTERIOR', 422),
      errorGraphql('PERIODO_FUTURO', 422),
    ];
    const { elemento, pulsarCrear } = montar({
      planillas: [
        { id: 'pl1', numero: 1, periodo: '2026-08', estado: 'APROBADA', neto: 1 },
        { id: 'pl2', numero: 2, periodo: '2026-09', estado: 'APROBADA', neto: 1 },
      ],
      crear: () => throwError(() => respuestas.shift()),
    });
    const aviso = () => elemento.querySelector('[role="alert"]')?.textContent?.trim();
    pulsarCrear();
    expect(aviso()).toBe('Ya hay una planilla sin aprobar en esta obra. Termínala antes de crear otra.');
    pulsarCrear();
    expect(aviso()).toBe('El periodo debe ser posterior al de la última planilla (Septiembre 2026).');
    pulsarCrear();
    expect(aviso()).toBe('No se puede crear la planilla de un mes que todavía no llegó.');
  });

  it('a quien no es el residente asignado le muestra «No tienes permiso…» (criterio 10)', () => {
    const { elemento } = montar({ usuario: { id: 'g1', roles: ['gerente'] } });
    expect(elemento.textContent).toContain('No tienes permiso para hacer esta acción.');
    expect(elemento.textContent).not.toContain('Crear planilla');
  });

  it('una obra que no está en ejecución no deja crear planillas', () => {
    const { elemento } = montar({ obra: { ...OBRA, estado: 'SIN_CONTRATO' } });
    expect(elemento.textContent).toContain('La obra no está en ejecución');
  });

  it('una obra que no existe o no ve muestra «Obra no encontrada»', () => {
    expect(montar({ obra: null }).elemento.textContent).toContain('Obra no encontrada');
  });
});
