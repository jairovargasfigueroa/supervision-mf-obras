import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import type { Obra } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import { ObraDetalleComponent, esperandoContrato } from './obra-detalle.component';

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
  partidas: [
    { id: 'p1', codigo: 'P-01', nombre: 'Losa', unidad: 'm2', cantidadContratada: 850, precioUnitario: 420.5, meses: null },
  ],
};

function montar(obtener: (id: string) => Observable<Obra | null>) {
  window.plataforma = { configuracion: { gatewayUrl: 'http://localhost:4000/graphql' } };
  TestBed.configureTestingModule({
    imports: [ObraDetalleComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'b1' })) } },
      { provide: ObrasService, useValue: { obtener } },
    ],
  });
  const fixture = TestBed.createComponent(ObraDetalleComponent);
  fixture.detectChanges();
  return { fixture, elemento: fixture.nativeElement as HTMLElement };
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

  it('muestra «Registrando contrato…» y consulta cada 2 s hasta EN_EJECUCION (criterio 8)', async () => {
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

  it('si Finanzas rechaza el contrato muestra el motivo y deja de consultar (criterio 9)', async () => {
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

  it('OBRA_NO_ENCONTRADA muestra «Obra no encontrada»', async () => {
    const error = new CombinedGraphQLErrors({
      data: { obra: null },
      errors: [{ message: 'Obra no encontrada', extensions: { codigo: 'OBRA_NO_ENCONTRADA', estado: 404 } }],
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fixture, elemento } = montar(() => throwError(() => error));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(elemento.textContent).toContain('Obra no encontrada');
  });
});
