import { TestBed } from '@angular/core/testing';
import { of, type Observable } from 'rxjs';
import { desdeLaRed } from '../../nucleo/plataforma-falsa';
import type { Cobro } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import { PestanaCobrosComponent, etiquetasCorreos, textoPagado } from './pestana-cobros.component';

// 201 · Cobranza automática: estado del pago, correos enviados y registro de pago en la pestaña «Cobros».

const PENDIENTE: Cobro = {
  id: 'c3',
  numero: 'COB-2027-0003',
  planillaId: 'pl3',
  montoNeto: 330149.1,
  emitidoEn: '2027-04-02T12:00:00Z',
  venceEn: '2027-05-02',
  estado: 'PENDIENTE',
  pagadoEn: null,
  comprobante: null,
  envios: [
    { tipo: 'NOTA_COBRO', destinatario: 'cliente1@correo.test', enviadoEn: '2027-04-02T12:05:00Z' },
  ],
};

const VENCIDO: Cobro = {
  ...PENDIENTE,
  id: 'c2',
  numero: 'COB-2027-0002',
  venceEn: '2027-04-01',
  estado: 'VENCIDO',
  envios: [
    { tipo: 'NOTA_COBRO', destinatario: 'cliente1@correo.test', enviadoEn: '2027-03-02T12:05:00Z' },
    {
      tipo: 'RECORDATORIO_POR_VENCER',
      destinatario: 'cliente1@correo.test',
      enviadoEn: '2027-03-29T12:00:00Z',
    },
    {
      tipo: 'RECORDATORIO_VENCIDO',
      destinatario: 'cliente1@correo.test',
      enviadoEn: '2027-04-02T12:00:00Z',
    },
  ],
};

const PAGADO: Cobro = {
  ...PENDIENTE,
  id: 'c1',
  numero: 'COB-2027-0001',
  estado: 'PAGADO',
  pagadoEn: '2027-04-28',
  comprobante: 'TRF-883412',
  envios: [
    { tipo: 'NOTA_COBRO', destinatario: 'cliente1@correo.test', enviadoEn: '2027-02-02T12:05:00Z' },
    { tipo: 'CONSTANCIA_PAGO', destinatario: 'cliente1@correo.test', enviadoEn: '2027-04-28T19:30:00Z' },
  ],
};

const texto = (nodo: Element | null) => nodo?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function montar(cobros: () => Observable<Cobro[] | null>) {
  const servicio = { cobros: vi.fn(cobros) };
  TestBed.configureTestingModule({
    imports: [PestanaCobrosComponent],
    providers: [{ provide: ObrasService, useValue: desdeLaRed(servicio) }],
  });
  const fixture = TestBed.createComponent(PestanaCobrosComponent);
  fixture.componentRef.setInput('obraId', 'b1');
  fixture.detectChanges();
  const elemento = fixture.nativeElement as HTMLElement;
  const esperar = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, elemento, servicio, esperar };
}

const fila = (elemento: HTMLElement, numero: string) =>
  [...elemento.querySelectorAll('tr.mat-mdc-row')].find((tr) => texto(tr.querySelector('td')) === numero)!;
const celda = (elemento: HTMLElement, numero: string, columna: string) =>
  fila(elemento, numero).querySelector(`td.mat-column-${columna}`);

describe('PestanaCobrosComponent (201)', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((nodo) => nodo.remove());
    delete window.plataforma;
  });

  it('etiquetasCorreos: una por envío con fecha y hora en La Paz, y «Nota sin enviar» si falta la nota', () => {
    expect(etiquetasCorreos(VENCIDO)).toEqual([
      // 12:05 UTC = 08:05 en La Paz
      { texto: 'Nota enviada', enviadoEn: '02/03/2027 08:05', sinEnviar: false },
      { texto: 'Recordatorio por vencer', enviadoEn: '29/03/2027 08:00', sinEnviar: false },
      { texto: 'Recordatorio de vencido', enviadoEn: '02/04/2027 08:00', sinEnviar: false },
    ]);
    expect(etiquetasCorreos(PAGADO).map((e) => e.texto)).toEqual(['Nota enviada', 'Constancia enviada']);
    expect(etiquetasCorreos({ envios: [] })).toEqual([
      { texto: 'Nota sin enviar', enviadoEn: null, sinEnviar: true },
    ]);
    // Un recordatorio sin nota (la nota falló): igual avisa que la nota no salió
    expect(etiquetasCorreos({ envios: [VENCIDO.envios[2]] }).map((e) => e.texto)).toEqual([
      'Nota sin enviar',
      'Recordatorio de vencido',
    ]);
    // Datos guardados en el equipo antes de la 201 (104), sin `envios`
    expect(etiquetasCorreos({} as Cobro).map((e) => e.texto)).toEqual(['Nota sin enviar']);
  });

  it('textoPagado: «Pagado el dd/mm/aaaa» solo en PAGADO', () => {
    expect(textoPagado(PAGADO)).toBe('Pagado el 28/04/2027');
    expect(textoPagado(PENDIENTE)).toBeNull();
    expect(textoPagado(VENCIDO)).toBeNull();
  });

  it('estado con color: PENDIENTE neutro, VENCIDO rojo y PAGADO verde con fecha y comprobante (criterios 3 y 5)', async () => {
    const { elemento, esperar } = montar(() => of([PENDIENTE, VENCIDO, PAGADO]));
    await esperar();
    const chip = (numero: string) => celda(elemento, numero, 'estado')!.querySelector('mat-chip')!;

    expect(texto(chip('COB-2027-0003'))).toBe('Pendiente');
    expect(chip('COB-2027-0003').classList).toContain('neutro');
    expect(texto(chip('COB-2027-0002'))).toBe('Vencido');
    expect(chip('COB-2027-0002').classList).toContain('error');
    expect(texto(chip('COB-2027-0001'))).toBe('Pagado el 28/04/2027');
    expect(chip('COB-2027-0001').classList).toContain('exito');
    expect(texto(celda(elemento, 'COB-2027-0001', 'estado')!.querySelector('.comprobante'))).toBe(
      'Comprobante: TRF-883412',
    );
    expect(celda(elemento, 'COB-2027-0003', 'estado')!.querySelector('.comprobante')).toBeNull();
  });

  it('un PAGADO sin comprobante no muestra la línea del comprobante', async () => {
    const { elemento, esperar } = montar(() => of([{ ...PAGADO, comprobante: null }]));
    await esperar();
    expect(texto(celda(elemento, 'COB-2027-0001', 'estado'))).toBe('Pagado el 28/04/2027');
    expect(elemento.querySelector('.comprobante')).toBeNull();
  });

  it('columna «Correos» con las etiquetas, su fecha y hora, y «Nota sin enviar» en ámbar (criterio 17)', async () => {
    const sinNota: Cobro = { ...PENDIENTE, id: 'c4', numero: 'COB-2027-0004', envios: [] };
    const { elemento, esperar } = montar(() => of([VENCIDO, PAGADO, sinNota]));
    await esperar();
    expect(texto(elemento.querySelector('tr.mat-mdc-header-row'))).toContain('Correos');

    const etiquetas = (numero: string) => [...celda(elemento, numero, 'correos')!.querySelectorAll('.correo')];
    expect(etiquetas('COB-2027-0002').map(texto)).toEqual([
      'Nota enviada',
      'Recordatorio por vencer',
      'Recordatorio de vencido',
    ]);
    expect(etiquetas('COB-2027-0002')[0].getAttribute('aria-label')).toBe('Nota enviada · 02/03/2027 08:05');
    expect(etiquetas('COB-2027-0001').map(texto)).toEqual(['Nota enviada', 'Constancia enviada']);
    // 19:30 UTC = 15:30 en La Paz
    expect(etiquetas('COB-2027-0001')[1].getAttribute('aria-label')).toBe(
      'Constancia enviada · 28/04/2027 15:30',
    );

    const sinEnviar = etiquetas('COB-2027-0004');
    expect(sinEnviar.map(texto)).toEqual(['Nota sin enviar']);
    expect(sinEnviar[0].classList).toContain('sin-enviar');
    expect(elemento.querySelectorAll('.sin-enviar')).toHaveLength(1);
  });
});
