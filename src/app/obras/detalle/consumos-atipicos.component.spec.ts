import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { of, throwError, type Observable } from 'rxjs';
import { desdeLaRed } from '../../nucleo/plataforma-falsa';
import type { ConsumoAtipico, EstadoRevision } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import {
  ConsumosAtipicosComponent,
  cantidadConsumo,
  puntajeConsumo,
} from './consumos-atipicos.component';
import { validarComentario } from './revision-dialogo.component';
import { FormControl } from '@angular/forms';

const PENDIENTE: ConsumoAtipico = {
  id: 'mv1',
  movimientoId: 'mv1',
  obraId: 'b1',
  materialId: 'm1',
  material: { id: 'm1', codigo: 'CEM-01', nombre: 'Cemento IP-30', unidad: 'bolsa', unidadPlural: 'bolsas' },
  partidaId: 'p1',
  cantidad: 120,
  periodo: '2026-11',
  registradoEn: '2026-11-15T02:40:00Z',
  puntaje: 0.7149,
  motivos: [
    'La cantidad es 4,2 veces la habitual de este material en la obra',
    'Se registró fuera del horario habitual (22:40)',
  ],
  estadoRevision: 'PENDIENTE',
  revisadoPor: null,
  revisadoEn: null,
  comentario: null,
  versionModelo: 'ca-1.0.0',
};

const CONFIRMADO: ConsumoAtipico = {
  ...PENDIENTE,
  id: 'mv2',
  movimientoId: 'mv2',
  partidaId: 'p9',
  material: null,
  cantidad: 1,
  estadoRevision: 'CONFIRMADO',
  revisadoPor: { id: 'r1', nombre: 'Rosa Vaca' },
  revisadoEn: '2026-11-16T14:00:00Z',
  comentario: 'Se usó en la losa de otra obra sin registrarlo',
};

function errorDe(codigo: string, extra: Record<string, unknown> = {}) {
  return new CombinedGraphQLErrors({
    data: null,
    errors: [{ message: 'x', extensions: { codigo, servicio: 'ia', ...extra } }],
  });
}

interface Opciones {
  puedeRevisar?: boolean;
  revisar?: (...args: unknown[]) => Observable<ConsumoAtipico>;
}

function montar(
  consumosAtipicos: (id: string, estado: EstadoRevision | null) => Observable<ConsumoAtipico[]>,
  { puedeRevisar = false, revisar = () => of(PENDIENTE) }: Opciones = {},
) {
  const servicio = { consumosAtipicos: vi.fn(consumosAtipicos), revisarConsumoAtipico: vi.fn(revisar) };
  TestBed.configureTestingModule({
    imports: [ConsumosAtipicosComponent],
    providers: [{ provide: ObrasService, useValue: desdeLaRed(servicio) }],
  });
  const fixture = TestBed.createComponent(ConsumosAtipicosComponent);
  fixture.componentRef.setInput('obraId', 'b1');
  fixture.componentRef.setInput('partidas', [{ id: 'p1', codigo: 'P-01' }]);
  fixture.componentRef.setInput('puedeRevisar', puedeRevisar);
  fixture.detectChanges();
  const elemento = fixture.nativeElement as HTMLElement;
  const esperar = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, elemento, servicio, esperar };
}

const texto = (nodo: Element | null) => nodo?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const botones = (raiz: ParentNode, nombre: string) =>
  [...raiz.querySelectorAll<HTMLButtonElement>('button')].filter((b) => texto(b) === nombre);
const dialogo = () => document.querySelector('mat-dialog-container');
const botonDialogo = (nombre: string) => botones(dialogo()!, nombre)[0];

describe('ConsumosAtipicosComponent (403)', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((nodo) => nodo.remove());
    delete window.plataforma;
  });

  it('cantidadConsumo y puntajeConsumo', () => {
    expect(cantidadConsumo(PENDIENTE)).toBe('120 bolsas');
    expect(cantidadConsumo({ ...PENDIENTE, cantidad: 1 })).toBe('1 bolsa');
    expect(cantidadConsumo({ cantidad: 12.5, material: null })).toBe('12,5');
    expect(puntajeConsumo(0.7149)).toEqual({ texto: '0,71', ancho: 71.49 });
    expect(puntajeConsumo(1.2).ancho).toBe(100);
  });

  it('validarComentario: obligatorio al confirmar, opcional en «Es normal», de 5 a 300 caracteres', () => {
    const control = (valor: string, estado: 'NORMAL' | 'CONFIRMADO') =>
      new FormControl(valor, { nonNullable: true, validators: validarComentario(estado) });
    expect(control('', 'CONFIRMADO').errors).toEqual({ required: true });
    expect(control('   ', 'CONFIRMADO').errors).toEqual({ required: true });
    expect(control('', 'NORMAL').errors).toBeNull();
    expect(control(' abcd ', 'NORMAL').errors).toEqual({ largo: true });
    expect(control('abcde', 'CONFIRMADO').errors).toBeNull();
    expect(control('a'.repeat(300), 'CONFIRMADO').errors).toBeNull();
    expect(control('a'.repeat(301), 'NORMAL').errors).toEqual({ largo: true });
  });

  it('pide los PENDIENTE y muestra fecha, material, partida, cantidad, puntaje, motivos y estado (criterio 6)', async () => {
    const { elemento, servicio, esperar } = montar(() => of([PENDIENTE]));
    await esperar();
    expect(servicio.consumosAtipicos).toHaveBeenCalledWith('b1', 'PENDIENTE');
    expect(texto(elemento.querySelector('h3'))).toBe('Consumos atípicos');
    expect(texto(elemento)).toContain(
      'Detectado por comparación con el consumo habitual; es distinto de "excedido sobre lo previsto"',
    );
    const celdas = [...elemento.querySelectorAll('tr.mat-mdc-row td')].map(texto);
    // 02:40 UTC es 22:40 del día anterior en La Paz
    expect(celdas[0]).toBe('14/11/2026 22:40');
    expect(celdas.slice(1, 5)).toEqual(['Cemento IP-30', 'P-01', '120 bolsas', '0,71']);
    expect(celdas[5]).toContain('La cantidad es 4,2 veces la habitual de este material en la obra');
    expect(celdas[5]).toContain('Se registró fuera del horario habitual (22:40)');
    expect(celdas[6]).toBe('Pendiente');
    expect(elemento.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('0.7149');
  });

  it('el filtro por estado vuelve a pedir; «Todos» no manda estado (criterio 6)', async () => {
    const { fixture, servicio, esperar } = montar(() => of([]));
    await esperar();
    const componente = fixture.componentInstance as unknown as { elegir(f: string): void };
    componente.elegir('NORMAL');
    componente.elegir('TODOS');
    expect(servicio.consumosAtipicos.mock.calls.map(([, estado]) => estado)).toEqual([
      'PENDIENTE',
      'NORMAL',
      null,
    ]);
    await esperar();
    expect(texto(fixture.nativeElement)).toContain('No hay consumos atípicos con este estado.');
  });

  it('un consumo revisado muestra quién, cuándo y el comentario, sin botones (criterio 9)', async () => {
    const { elemento, esperar } = montar(() => of([CONFIRMADO]), { puedeRevisar: true });
    await esperar();
    const celdas = [...elemento.querySelectorAll('tr.mat-mdc-row td')].map(texto);
    expect(celdas.slice(1, 4)).toEqual(['—', '—', '1']);
    expect(celdas[6]).toContain('Problema confirmado');
    expect(celdas[6]).toContain('Rosa Vaca · 16/11/2026 10:00');
    expect(celdas[6]).toContain('«Se usó en la losa de otra obra sin registrarlo»');
    expect(botones(elemento, 'Es normal')).toHaveLength(0);
  });

  it('si IA no responde muestra «—» con «Datos de IA no disponibles» y «Reintentar» (criterio 12)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let llamadas = 0;
    const { elemento, servicio, esperar } = montar(() =>
      ++llamadas === 1 ? throwError(() => errorDe('SERVICIO_NO_DISPONIBLE')) : of([PENDIENTE]),
    );
    await esperar();
    const aviso = elemento.querySelector('.ia-no-disponible');
    expect(texto(aviso?.querySelector('strong') ?? null)).toBe('—');
    expect(texto(aviso)).toContain('Datos de IA no disponibles');
    expect(elemento.querySelector('table')).toBeNull();

    botones(elemento, 'Reintentar')[0].click();
    await esperar();
    expect(servicio.consumosAtipicos).toHaveBeenCalledTimes(2);
    expect(elemento.querySelector('table')).toBeTruthy();
  });

  describe('revisión (criterios 7 y 8)', () => {
    it('sin permiso (gerente u otro residente) no hay botones', async () => {
      const { elemento, esperar } = montar(() => of([PENDIENTE]));
      await esperar();
      expect(botones(elemento, 'Es normal')).toHaveLength(0);
      expect(botones(elemento, 'Confirmar problema')).toHaveLength(0);
      expect(elemento.querySelectorAll('th')).toHaveLength(7);
    });

    it('con permiso, solo los PENDIENTE tienen «Es normal» y «Confirmar problema»', async () => {
      const { elemento, esperar } = montar(() => of([PENDIENTE, CONFIRMADO]), { puedeRevisar: true });
      await esperar();
      expect(botones(elemento, 'Es normal')).toHaveLength(1);
      expect(botones(elemento, 'Confirmar problema')).toHaveLength(1);
    });

    it('sin conexión los botones quedan deshabilitados («Requiere conexión»)', async () => {
      window.plataforma = {
        configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
        conexion: { enLinea: false, reportarFallo: () => undefined },
      } as never;
      const { elemento, esperar } = montar(() => of([PENDIENTE]), { puedeRevisar: true });
      await esperar();
      expect(botones(elemento, 'Es normal')[0].disabled).toBe(true);
      expect(elemento.querySelector('app-requiere-conexion span')?.getAttribute('aria-label')).toBe(
        'Requiere conexión',
      );
    });

    it('«Confirmar problema» exige el comentario y lo manda sin espacios de más; luego recarga', async () => {
      const revisar = vi.fn(() => of({ ...PENDIENTE, estadoRevision: 'CONFIRMADO' as const }));
      const { elemento, servicio, esperar } = montar(() => of([PENDIENTE]), {
        puedeRevisar: true,
        revisar,
      });
      await esperar();
      botones(elemento, 'Confirmar problema')[0].click();
      await esperar();
      expect(texto(dialogo()!.querySelector('h2'))).toBe('Confirmar problema');
      expect(texto(dialogo())).toContain('Obligatorio, de 5 a 300 caracteres');
      expect(texto(dialogo())).toContain('0 / 300');

      botonDialogo('Confirmar problema').click();
      await esperar();
      expect(revisar).not.toHaveBeenCalled();
      expect(texto(dialogo()!.querySelector('mat-error'))).toBe('Obligatorio');

      const campo = dialogo()!.querySelector('textarea')!;
      campo.value = '  Se usó en otra obra  ';
      campo.dispatchEvent(new Event('input'));
      await esperar();
      expect(texto(dialogo())).toContain('23 / 300');
      botonDialogo('Confirmar problema').click();
      await esperar();
      expect(revisar).toHaveBeenCalledWith('mv1', 'CONFIRMADO', 'Se usó en otra obra');
      await vi.waitFor(() => expect(servicio.consumosAtipicos).toHaveBeenCalledTimes(2));
    });

    it('«Es normal» admite enviar sin comentario', async () => {
      const revisar = vi.fn(() => of({ ...PENDIENTE, estadoRevision: 'NORMAL' as const }));
      const { elemento, esperar } = montar(() => of([PENDIENTE]), { puedeRevisar: true, revisar });
      await esperar();
      botones(elemento, 'Es normal')[0].click();
      await esperar();
      expect(texto(dialogo())).toContain('Opcional, de 5 a 300 caracteres');
      botonDialogo('Es normal').click();
      await esperar();
      expect(revisar).toHaveBeenCalledWith('mv1', 'NORMAL', null);
    });

    it('si ya fue revisado avisa «Este consumo ya fue revisado» y recarga la lista (criterio 8)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { elemento, servicio, esperar } = montar(() => of([PENDIENTE]), {
        puedeRevisar: true,
        revisar: () => throwError(() => errorDe('REVISION_YA_REGISTRADA', { estado: 409 })),
      });
      await esperar();
      botones(elemento, 'Es normal')[0].click();
      await esperar();
      botonDialogo('Es normal').click();
      await esperar();
      await vi.waitFor(() => expect(dialogo()).toBeNull());
      await esperar();
      expect(texto(elemento.querySelector('[role="alert"]'))).toBe('Este consumo ya fue revisado');
      expect(servicio.consumosAtipicos).toHaveBeenCalledTimes(2);
    });

    it('COMENTARIO_INVALIDO deja el diálogo abierto con «Revisa el comentario.» y la regla junto al campo', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const regla = 'El comentario debe tener entre 5 y 300 caracteres';
      const { elemento, esperar } = montar(() => of([PENDIENTE]), {
        puedeRevisar: true,
        revisar: () =>
          throwError(() =>
            errorDe('COMENTARIO_INVALIDO', {
              estado: 422,
              errores: [{ campo: 'comentario', mensaje: regla }],
            }),
          ),
      });
      await esperar();
      botones(elemento, 'Confirmar problema')[0].click();
      await esperar();
      const campo = dialogo()!.querySelector('textarea')!;
      campo.value = 'Se usó en otra obra';
      campo.dispatchEvent(new Event('input'));
      botonDialogo('Confirmar problema').click();
      await esperar();
      expect(texto(dialogo()!.querySelector('[role="alert"]'))).toBe('Revisa el comentario.');
      expect(texto(dialogo()!.querySelector('mat-error'))).toBe(regla);
    });
  });
});
