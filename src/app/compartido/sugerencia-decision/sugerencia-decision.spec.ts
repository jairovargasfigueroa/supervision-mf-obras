import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { Apollo } from 'apollo-angular';
import { firstValueFrom, of, throwError } from 'rxjs';
import { validarTextoDecision, type ResultadoDecision } from './sugerencia-decision.component';
import type { Sugerencia } from './sugerencia-decision.graphql';
import { SugerenciaDecisionService } from './sugerencia-decision.service';

const SUGERENCIA: Sugerencia = {
  id: 's1',
  ejecucionId: 'e1',
  agente: 'SEGUIMIENTO_OBRAS',
  obraId: 'b1',
  obraNombre: 'Condominio Las Lomas',
  accion: 'PROGRAMAR_VISITA',
  accionTexto: 'Programar una visita de supervisión a la obra',
  descripcion: 'La obra va 14 puntos atrasada',
  estado: 'PENDIENTE',
  creadaEn: '2027-04-20T10:01:12Z',
  decididaPor: null,
  decididaEn: null,
  comentario: null,
};

function errorDe(codigo: string, extra: Record<string, unknown> = {}) {
  return new CombinedGraphQLErrors({
    data: null,
    errors: [{ message: 'x', extensions: { codigo, servicio: 'ia', ...extra } }],
  });
}

function montar(mutate: (...args: unknown[]) => unknown) {
  const apollo = { mutate: vi.fn(mutate) };
  TestBed.configureTestingModule({
    providers: [SugerenciaDecisionService, { provide: Apollo, useValue: apollo }],
  });
  return { servicio: TestBed.inject(SugerenciaDecisionService), apollo };
}

const texto = (nodo: Element | null) => nodo?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const dialogo = () => document.querySelector('mat-dialog-container');
const boton = (nombre: string) =>
  [...dialogo()!.querySelectorAll<HTMLButtonElement>('button')].find((b) => texto(b) === nombre)!;
const esperar = async () => {
  await new Promise((r) => setTimeout(r, 0));
  TestBed.tick();
};
function escribir(valor: string) {
  const campo = dialogo()!.querySelector('textarea')!;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

describe('sugerencia-decision (502)', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((nodo) => nodo.remove());
  });

  it('validarTextoDecision: comentario opcional hasta 300; motivo obligatorio de 10 a 500', () => {
    const control = (valor: string, modo: 'aprobar' | 'rechazar') =>
      new FormControl(valor, { nonNullable: true, validators: validarTextoDecision(modo) });
    expect(control('', 'aprobar').errors).toBeNull();
    expect(control('a'.repeat(300), 'aprobar').errors).toBeNull();
    expect(control('a'.repeat(301), 'aprobar').errors).toEqual({ largo: true });
    expect(control('   ', 'rechazar').errors).toEqual({ required: true });
    expect(control(' 123456789 ', 'rechazar').errors).toEqual({ largo: true });
    expect(control('1234567890', 'rechazar').errors).toBeNull();
    expect(control('a'.repeat(501), 'rechazar').errors).toEqual({ largo: true });
  });

  it('aprobar sin comentario manda solo el id y avisa que solo registra la decisión (criterio 12)', async () => {
    const { servicio, apollo } = montar(() =>
      of({ data: { aprobarSugerencia: { ...SUGERENCIA, estado: 'APROBADA' } } }),
    );
    const cierre = firstValueFrom(servicio.decidir(SUGERENCIA, 'aprobar'));
    await esperar();
    expect(texto(dialogo()!.querySelector('h2'))).toBe('Aprobar sugerencia');
    expect(texto(dialogo())).toContain('Programar una visita de supervisión a la obra');
    expect(texto(dialogo())).toContain('Aprobar solo registra tu decisión');
    expect(texto(dialogo())).toContain('0 / 300');
    boton('Aprobar').click();
    expect(await cierre).toEqual({ tipo: 'decidida' });
    expect(apollo.mutate.mock.calls[0][0]).toMatchObject({ variables: { id: 's1' } });
  });

  it('aprobar con comentario lo manda sin espacios de más', async () => {
    const { servicio, apollo } = montar(() => of({ data: { aprobarSugerencia: SUGERENCIA } }));
    const cierre = firstValueFrom(servicio.decidir(SUGERENCIA, 'aprobar'));
    await esperar();
    escribir('  Visita el lunes  ');
    await esperar();
    boton('Aprobar').click();
    await cierre;
    expect(apollo.mutate.mock.calls[0][0]).toMatchObject({
      variables: { id: 's1', comentario: 'Visita el lunes' },
    });
  });

  it('rechazar exige un motivo de 10 a 500 caracteres con contador (criterio 13)', async () => {
    const { servicio, apollo } = montar(() =>
      of({ data: { rechazarSugerencia: { ...SUGERENCIA, estado: 'RECHAZADA' } } }),
    );
    const cierre = firstValueFrom(servicio.decidir(SUGERENCIA, 'rechazar'));
    await esperar();
    expect(texto(dialogo()!.querySelector('h2'))).toBe('Rechazar sugerencia');
    expect(texto(dialogo())).toContain('Obligatorio, de 10 a 500 caracteres');
    boton('Rechazar').click();
    await esperar();
    expect(apollo.mutate).not.toHaveBeenCalled();
    expect(texto(dialogo()!.querySelector('mat-error'))).toBe('Obligatorio');

    escribir('corto');
    await esperar();
    boton('Rechazar').click();
    await esperar();
    expect(apollo.mutate).not.toHaveBeenCalled();
    expect(texto(dialogo()!.querySelector('mat-error'))).toBe(
      'Debe tener entre 10 y 500 caracteres',
    );

    escribir('Ya se visitó la obra ayer');
    await esperar();
    expect(texto(dialogo())).toContain('25 / 500');
    boton('Rechazar').click();
    expect(await cierre).toEqual({ tipo: 'decidida' });
    expect(apollo.mutate.mock.calls[0][0]).toMatchObject({
      variables: { id: 's1', motivo: 'Ya se visitó la obra ayer' },
    });
  });

  it.each([
    ['SUGERENCIA_YA_DECIDIDA', 'Esta sugerencia ya fue aprobada o rechazada. Recarga la lista.'],
    ['SUGERENCIA_NO_ENCONTRADA', 'No encontramos esa sugerencia o no tienes acceso a ella.'],
  ])('%s cierra el diálogo con su aviso (criterio 14)', async (codigo, mensaje) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { servicio } = montar(() => throwError(() => errorDe(codigo)));
    const cierre = firstValueFrom(servicio.decidir(SUGERENCIA, 'aprobar'));
    await esperar();
    boton('Aprobar').click();
    expect(await cierre).toEqual({ tipo: 'aviso', mensaje } satisfies ResultadoDecision);
  });

  it('MOTIVO_INVALIDO muestra el mensaje arriba y la regla junto al campo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { servicio } = montar(() =>
      throwError(() =>
        errorDe('MOTIVO_INVALIDO', {
          errores: [{ campo: 'motivo', mensaje: 'Máximo 500 caracteres' }],
        }),
      ),
    );
    void firstValueFrom(servicio.decidir(SUGERENCIA, 'rechazar'));
    await esperar();
    escribir('Un motivo suficiente');
    await esperar();
    boton('Rechazar').click();
    await esperar();
    expect(texto(dialogo()!.querySelector('[role="alert"]'))).toBe(
      'El motivo debe tener entre 10 y 500 caracteres.',
    );
    expect(texto(dialogo()!.querySelector('mat-error'))).toBe('Máximo 500 caracteres');
  });
});
