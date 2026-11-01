import { TestBed } from '@angular/core/testing';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { Apollo } from 'apollo-angular';
import { of, throwError, type Observable } from 'rxjs';
import type { Sugerencia } from '../../compartido/sugerencia-decision/sugerencia-decision.graphql';
import { SugerenciaDecisionService } from '../../compartido/sugerencia-decision/sugerencia-decision.service';
import { desdeLaRed } from '../../nucleo/plataforma-falsa';
import type { AgentesObra, Hallazgo } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import {
  PestanaAgentesComponent,
  agentesDeLaPestana,
  textoTipoHallazgo,
} from './pestana-agentes.component';

const ATRASO: Hallazgo = {
  ejecucionId: 'e1',
  agente: 'SEGUIMIENTO_OBRAS',
  obraId: 'b1',
  obraNombre: 'Edificio Las Palmas',
  tipo: 'ATRASO',
  severidad: 'ALTA',
  situacion: 'Avance 20 % con 34 % del plazo',
  causaProbable: 'Lluvias en 5 de los últimos 14 días',
  evidencia: [
    { herramienta: 'avance_obra', dato: 'avance 20, plazo 34' },
    { herramienta: 'buscar_diario', dato: '5 entradas con lluvia' },
  ],
  detectadoEn: '2026-11-01T10:01:12Z',
};
const COBRO: Hallazgo = {
  ...ATRASO,
  ejecucionId: 'e3',
  agente: 'CONTROL_COBROS',
  tipo: 'COBRO_VENCIDO',
  severidad: 'MEDIA',
  situacion: 'Cobro C-0007 vencido hace 12 días',
  evidencia: [{ herramienta: 'cobros_por_vencer', dato: 'C-0007 vencido' }],
};
const STOCK: Hallazgo = {
  ...ATRASO,
  ejecucionId: 'e2',
  agente: 'CONTROL_MATERIALES',
  tipo: 'STOCK_BAJO',
  situacion: 'Cemento IP-30: 80 bolsas, mínimo 100',
};

const VISITA: Sugerencia = {
  id: 's1',
  ejecucionId: 'e1',
  agente: 'SEGUIMIENTO_OBRAS',
  obraId: 'b1',
  obraNombre: 'Edificio Las Palmas',
  accion: 'PROGRAMAR_VISITA',
  accionTexto: 'Programar una visita de supervisión a la obra',
  descripcion: 'La obra va 14 puntos atrasada',
  estado: 'PENDIENTE',
  creadaEn: '2026-11-01T10:01:12Z',
  decididaPor: null,
  decididaEn: null,
  comentario: null,
};
const CONTACTAR: Sugerencia = {
  ...VISITA,
  id: 's2',
  ejecucionId: 'e3',
  agente: 'CONTROL_COBROS',
  accion: 'CONTACTAR_CLIENTE_COBRO',
  accionTexto: 'Contactar al cliente por el cobro vencido o por vencer',
};
const INVENTARIO: Sugerencia = {
  ...VISITA,
  id: 's3',
  ejecucionId: 'e2',
  agente: 'CONTROL_MATERIALES',
  accion: 'VERIFICAR_INVENTARIO',
  accionTexto: 'Hacer un conteo físico del material en el depósito de la obra',
};

const TODO: AgentesObra = {
  hallazgos: [ATRASO, COBRO, STOCK],
  sugerencias: [VISITA, CONTACTAR, INVENTARIO],
};

function errorDe(codigo: string, extra: Record<string, unknown> = {}) {
  return new CombinedGraphQLErrors({
    data: null,
    errors: [{ message: 'x', extensions: { codigo, servicio: 'ia', ...extra } }],
  });
}

interface Opciones {
  veCobros?: boolean;
  mutate?: (...args: unknown[]) => unknown;
}

function montar(
  agentes: (id: string) => Observable<AgentesObra>,
  { veCobros = false, mutate = () => of({ data: { aprobarSugerencia: VISITA } }) }: Opciones = {},
) {
  const servicio = { agentes: vi.fn(agentes) };
  const apollo = { mutate: vi.fn(mutate) };
  TestBed.configureTestingModule({
    imports: [PestanaAgentesComponent],
    providers: [
      { provide: ObrasService, useValue: desdeLaRed(servicio) },
      { provide: Apollo, useValue: apollo },
      SugerenciaDecisionService,
    ],
  });
  const fixture = TestBed.createComponent(PestanaAgentesComponent);
  fixture.componentRef.setInput('obraId', 'b1');
  fixture.componentRef.setInput('veCobros', veCobros);
  fixture.detectChanges();
  const elemento = fixture.nativeElement as HTMLElement;
  const esperar = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, elemento, servicio, apollo, esperar };
}

const texto = (nodo: Element | null) => nodo?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const botones = (raiz: ParentNode, nombre: string) =>
  [...raiz.querySelectorAll<HTMLButtonElement>('button')].filter((b) => texto(b) === nombre);
const seccion = (raiz: HTMLElement, nombre: string) =>
  raiz.querySelector<HTMLElement>(`section[aria-label="${nombre}"]`);
const dialogo = () => document.querySelector('mat-dialog-container');
const botonDialogo = (nombre: string) => botones(dialogo()!, nombre)[0];

describe('PestanaAgentesComponent (502)', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((nodo) => nodo.remove());
    delete window.plataforma;
  });

  it('agentesDeLaPestana y textoTipoHallazgo', () => {
    expect(agentesDeLaPestana(false)).toEqual(['SEGUIMIENTO_OBRAS']);
    expect(agentesDeLaPestana(true)).toEqual(['SEGUIMIENTO_OBRAS', 'CONTROL_COBROS']);
    expect(textoTipoHallazgo('PLANILLA_OBSERVADA_SIN_CORREGIR')).toBe(
      'Planilla observada sin corregir',
    );
    expect(textoTipoHallazgo('OTRO')).toBe('OTRO');
  });

  it('admin y gerente ven Seguimiento de obras y Control de cobros, no Control de materiales (criterio 17)', async () => {
    const { elemento, servicio, esperar } = montar(() => of(TODO), { veCobros: true });
    await esperar();
    expect(servicio.agentes).toHaveBeenCalledWith('b1');

    const hallazgos = [...seccion(elemento, 'Hallazgos')!.querySelectorAll('li.hallazgo')];
    expect(hallazgos).toHaveLength(2);
    expect(texto(hallazgos[0])).toContain('Atraso');
    expect(texto(hallazgos[0].querySelector('app-estado-chip'))).toBe('Alta');
    // 10:01 UTC es 06:01 en La Paz
    expect(texto(hallazgos[0])).toContain('Seguimiento de obras · 01/11/2026 06:01');
    expect(texto(hallazgos[0])).toContain('Avance 20 % con 34 % del plazo');
    expect(texto(hallazgos[0])).toContain('Causa probable: Lluvias en 5 de los últimos 14 días');
    expect([...hallazgos[0].querySelectorAll('.evidencia li')].map(texto)).toEqual([
      'avance_obra: avance 20, plazo 34',
      'buscar_diario: 5 entradas con lluvia',
    ]);
    expect(texto(hallazgos[1])).toContain('Cobro vencido');
    expect(texto(hallazgos[1].querySelector('app-estado-chip'))).toBe('Media');
    expect(texto(elemento)).not.toContain('Cemento IP-30');

    const sugerencias = [...seccion(elemento, 'Sugerencias pendientes')!.querySelectorAll('li')];
    expect(sugerencias.map((s) => texto(s.querySelector('strong')))).toEqual([
      'Programar una visita de supervisión a la obra',
      'Contactar al cliente por el cobro vencido o por vencer',
    ]);
    expect(texto(sugerencias[0])).toContain('La obra va 14 puntos atrasada');
    expect(botones(elemento, 'Aprobar')).toHaveLength(2);
    expect(botones(elemento, 'Rechazar')).toHaveLength(2);
  });

  it('el residente no ve Control de cobros (criterios 17 y 20)', async () => {
    const { elemento, esperar } = montar(() => of(TODO));
    await esperar();
    expect(seccion(elemento, 'Hallazgos')!.querySelectorAll('li.hallazgo')).toHaveLength(1);
    expect(texto(elemento)).not.toContain('Cobro vencido');
    expect(texto(elemento)).not.toContain('Contactar al cliente');
    expect(botones(elemento, 'Aprobar')).toHaveLength(1);
  });

  it('sin hallazgos ni sugerencias muestra los estados vacíos', async () => {
    const { elemento, esperar } = montar(() => of({ hallazgos: [STOCK], sugerencias: [] }));
    await esperar();
    expect(texto(elemento)).toContain('No hay hallazgos vigentes en esta obra.');
    expect(texto(elemento)).toContain('No hay sugerencias pendientes en esta obra.');
  });

  it('el texto del agente con etiquetas HTML se muestra como texto', async () => {
    const malicioso = '<img src="x" onerror="alert(1)"><b>urgente</b>';
    const { elemento, esperar } = montar(() =>
      of({
        hallazgos: [{ ...ATRASO, situacion: malicioso }],
        sugerencias: [{ ...VISITA, descripcion: malicioso }],
      }),
    );
    await esperar();
    expect(elemento.querySelector('img, b')).toBeNull();
    expect(texto(elemento.querySelector('.situacion'))).toBe(malicioso);
    expect(texto(elemento.querySelector('.descripcion'))).toBe(malicioso);
  });

  describe('IA no responde (criterio 21)', () => {
    it('ambos campos en null: «No disponible por el momento» y «Reintentar» vuelve a pedir', async () => {
      let llamadas = 0;
      const { elemento, servicio, esperar } = montar(() =>
        of(++llamadas === 1 ? { hallazgos: null, sugerencias: null } : TODO),
      );
      await esperar();
      expect(texto(elemento.querySelector('app-estado-error'))).toContain(
        'No disponible por el momento.',
      );
      expect(seccion(elemento, 'Hallazgos')).toBeNull();

      botones(elemento, 'Reintentar')[0].click();
      await esperar();
      expect(servicio.agentes).toHaveBeenCalledTimes(2);
      expect(elemento.querySelector('app-estado-error')).toBeNull();
      expect(seccion(elemento, 'Hallazgos')!.querySelectorAll('li.hallazgo')).toHaveLength(1);
    });

    it('solo un campo en null: solo su sección muestra el error', async () => {
      const { elemento, esperar } = montar(() => of({ hallazgos: [ATRASO], sugerencias: null }));
      await esperar();
      expect(seccion(elemento, 'Hallazgos')!.querySelector('app-estado-error')).toBeNull();
      expect(texto(seccion(elemento, 'Hallazgos'))).toContain('Atraso');
      expect(texto(seccion(elemento, 'Sugerencias pendientes'))).toContain(
        'No disponible por el momento.',
      );
    });

    it('si la consulta falla, la pestaña muestra su error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { elemento, esperar } = montar(() =>
        throwError(() => errorDe('SERVICIO_NO_DISPONIBLE')),
      );
      await esperar();
      expect(texto(elemento.querySelector('app-estado-error'))).toContain(
        'No disponible por el momento.',
      );
    });
  });

  describe('decisión (criterios 12 a 14)', () => {
    it('sin conexión «Aprobar» y «Rechazar» quedan deshabilitados («Requiere conexión»)', async () => {
      window.plataforma = {
        configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
        conexion: { enLinea: false, reportarFallo: () => undefined },
      } as never;
      const { elemento, esperar } = montar(() => of(TODO));
      await esperar();
      expect(botones(elemento, 'Aprobar')[0].disabled).toBe(true);
      expect(botones(elemento, 'Rechazar')[0].disabled).toBe(true);
      expect(elemento.querySelector('app-requiere-conexion span')?.getAttribute('aria-label')).toBe(
        'Requiere conexión',
      );
    });

    it('«Aprobar» abre el diálogo, registra la decisión y vuelve a pedir la pestaña', async () => {
      const { elemento, servicio, apollo, esperar } = montar(() => of(TODO));
      await esperar();
      botones(elemento, 'Aprobar')[0].click();
      await esperar();
      expect(texto(dialogo()!.querySelector('h2'))).toBe('Aprobar sugerencia');
      botonDialogo('Aprobar').click();
      await esperar();
      expect(apollo.mutate.mock.calls[0][0]).toMatchObject({ variables: { id: 's1' } });
      await vi.waitFor(() => expect(servicio.agentes).toHaveBeenCalledTimes(2));
    });

    it('«Rechazar» manda el motivo', async () => {
      const { elemento, apollo, esperar } = montar(() => of(TODO), {
        mutate: () => of({ data: { rechazarSugerencia: { ...VISITA, estado: 'RECHAZADA' } } }),
      });
      await esperar();
      botones(elemento, 'Rechazar')[0].click();
      await esperar();
      const campo = dialogo()!.querySelector('textarea')!;
      campo.value = 'Ya se visitó la obra ayer';
      campo.dispatchEvent(new Event('input'));
      await esperar();
      botonDialogo('Rechazar').click();
      await esperar();
      expect(apollo.mutate.mock.calls[0][0]).toMatchObject({
        variables: { id: 's1', motivo: 'Ya se visitó la obra ayer' },
      });
    });

    it('si otra persona ya la decidió, avisa y recarga (criterio 14)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { elemento, servicio, esperar } = montar(() => of(TODO), {
        mutate: () => throwError(() => errorDe('SUGERENCIA_YA_DECIDIDA', { estado: 409 })),
      });
      await esperar();
      botones(elemento, 'Aprobar')[0].click();
      await esperar();
      botonDialogo('Aprobar').click();
      await esperar();
      await vi.waitFor(() => expect(dialogo()).toBeNull());
      await esperar();
      expect(texto(elemento.querySelector('[role="alert"]'))).toBe(
        'Esta sugerencia ya fue aprobada o rechazada. Recarga la lista.',
      );
      expect(servicio.agentes).toHaveBeenCalledTimes(2);
    });

    it('«Cancelar» no recarga', async () => {
      const { elemento, servicio, apollo, esperar } = montar(() => of(TODO));
      await esperar();
      botones(elemento, 'Aprobar')[0].click();
      await esperar();
      botonDialogo('Cancelar').click();
      await vi.waitFor(() => expect(dialogo()).toBeNull());
      expect(apollo.mutate).not.toHaveBeenCalled();
      expect(servicio.agentes).toHaveBeenCalledTimes(1);
    });
  });
});
