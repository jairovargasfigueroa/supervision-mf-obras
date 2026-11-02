import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { of, throwError, type Observable } from 'rxjs';
import { desdeLaRed } from '../../nucleo/plataforma-falsa';
import type { Cobro } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import {
  PestanaCobrosComponent,
  admitePago,
  etiquetasCorreos,
  textoPagado,
} from './pestana-cobros.component';

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
    {
      tipo: 'CONSTANCIA_PAGO',
      destinatario: 'cliente1@correo.test',
      enviadoEn: '2027-04-28T19:30:00Z',
    },
  ],
};

const texto = (nodo: Element | null) => nodo?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function errorDe(codigo: string, estado: number) {
  return new CombinedGraphQLErrors({
    data: null,
    errors: [{ message: 'x', extensions: { codigo, servicio: 'finanzas', estado } }],
  });
}

interface Opciones {
  puedeRegistrarPago?: boolean;
  registrar?: (cobroId: string, pagadoEn: string, comprobante: string | null) => Observable<Cobro>;
}

function montar(
  cobros: () => Observable<Cobro[] | null>,
  { puedeRegistrarPago = false, registrar = () => of(PAGADO) }: Opciones = {},
) {
  const servicio = { cobros: vi.fn(cobros), registrarPagoCobro: vi.fn(registrar) };
  const avisos: string[] = [];
  TestBed.configureTestingModule({
    imports: [PestanaCobrosComponent],
    providers: [
      { provide: ObrasService, useValue: desdeLaRed(servicio) },
      { provide: MatSnackBar, useValue: { open: (aviso: string) => avisos.push(aviso) } },
    ],
  });
  const fixture = TestBed.createComponent(PestanaCobrosComponent);
  fixture.componentRef.setInput('obraId', 'b1');
  fixture.componentRef.setInput('puedeRegistrarPago', puedeRegistrarPago);
  fixture.detectChanges();
  const elemento = fixture.nativeElement as HTMLElement;
  const esperar = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, elemento, servicio, avisos, esperar };
}

const botones = (raiz: ParentNode, nombre: string) =>
  [...raiz.querySelectorAll<HTMLButtonElement>('button')].filter((b) => texto(b) === nombre);
const dialogo = () => document.querySelector('mat-dialog-container');
const botonDialogo = (nombre: string) => botones(dialogo()!, nombre)[0];
const campo = (etiqueta: string) =>
  [...dialogo()!.querySelectorAll('mat-form-field')]
    .find((f) => texto(f.querySelector('mat-label')) === etiqueta)!
    .querySelector('input')!;
function escribir(entrada: HTMLInputElement, valor: string) {
  entrada.value = valor;
  entrada.dispatchEvent(new Event('input'));
}

const fila = (elemento: HTMLElement, numero: string) =>
  [...elemento.querySelectorAll('tr.mat-mdc-row')].find(
    (tr) => texto(tr.querySelector('td')) === numero,
  )!;
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
    expect(etiquetasCorreos(PAGADO).map((e) => e.texto)).toEqual([
      'Nota enviada',
      'Constancia enviada',
    ]);
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

    const etiquetas = (numero: string) => [
      ...celda(elemento, numero, 'correos')!.querySelectorAll('.correo'),
    ];
    expect(etiquetas('COB-2027-0002').map(texto)).toEqual([
      'Nota enviada',
      'Recordatorio por vencer',
      'Recordatorio de vencido',
    ]);
    expect(etiquetas('COB-2027-0002')[0].getAttribute('aria-label')).toBe(
      'Nota enviada · 02/03/2027 08:05',
    );
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

  describe('registrar pago (criterios 1 a 5)', () => {
    // Hoy: 29/04/2027 en La Paz (11:00); el cobro de prueba se emitió el 02/04/2027
    beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-04-29T15:00:00Z') }));
    afterEach(() => vi.useRealTimers());

    /** Monta la pestaña con «Registrar pago» y abre el diálogo del primer botón. */
    async function abrir(opciones: Opciones = {}, cobros: Cobro[] = [PENDIENTE]) {
      const montado = montar(() => of(cobros), { puedeRegistrarPago: true, ...opciones });
      await montado.esperar();
      botones(montado.elemento, 'Registrar pago')[0].click();
      await montado.esperar();
      return montado;
    }

    it('admitePago: solo PENDIENTE y VENCIDO', () => {
      expect(admitePago(PENDIENTE)).toBe(true);
      expect(admitePago(VENCIDO)).toBe(true);
      expect(admitePago(PAGADO)).toBe(false);
    });

    it('el diálogo trae la fecha de hoy y el comprobante vacío, con sus límites (criterio 2)', async () => {
      await abrir();
      expect(texto(dialogo()!.querySelector('h2'))).toBe('Registrar pago');
      expect(texto(dialogo())).toContain('Cobro COB-2027-0003 · Bs 330.149,10');
      const fecha = campo('Fecha de pago');
      expect(fecha.type).toBe('date');
      expect(fecha.value).toBe('2027-04-29');
      expect(fecha.getAttribute('min')).toBe('2027-04-02');
      expect(fecha.getAttribute('max')).toBe('2027-04-29');
      expect(campo('N.º de comprobante (opcional)').value).toBe('');
      expect(texto(dialogo())).toContain('0 / 50');
    });

    it('registra con la fecha y el comprobante sin espacios; avisa «Pago registrado» y recarga (criterio 3)', async () => {
      const registrar = vi.fn(() => of(PAGADO));
      const { servicio, avisos, esperar } = await abrir({ registrar });
      escribir(campo('Fecha de pago'), '2027-04-28');
      escribir(campo('N.º de comprobante (opcional)'), '  TRF-883412 ');
      await esperar();
      expect(texto(dialogo())).toContain('13 / 50');
      botonDialogo('Registrar').click();
      await esperar();
      expect(registrar).toHaveBeenCalledWith('c3', '2027-04-28', 'TRF-883412');
      await vi.waitFor(() => expect(dialogo()).toBeNull());
      expect(avisos).toEqual(['Pago registrado']);
      expect(servicio.cobros).toHaveBeenCalledTimes(2);
    });

    it('sin comprobante lo manda en null', async () => {
      const registrar = vi.fn(() => of(PAGADO));
      const { esperar } = await abrir({ registrar });
      escribir(campo('N.º de comprobante (opcional)'), '   ');
      botonDialogo('Registrar').click();
      await esperar();
      expect(registrar).toHaveBeenCalledWith('c3', '2027-04-29', null);
    });

    it('admin ve «Registrar pago» solo en los cobros PENDIENTE o VENCIDO (criterio 1)', async () => {
      const { elemento, esperar } = montar(() => of([PENDIENTE, VENCIDO, PAGADO]), {
        puedeRegistrarPago: true,
      });
      await esperar();
      expect(botones(elemento, 'Registrar pago')).toHaveLength(2);
      expect(botones(fila(elemento, 'COB-2027-0001'), 'Registrar pago')).toHaveLength(0);
    });

    it('sin permiso (gerente) no hay botón ni columna de acciones, y ve los datos del pago (criterio 5)', async () => {
      const { elemento, esperar } = montar(() => of([PENDIENTE, VENCIDO, PAGADO]));
      await esperar();
      expect(botones(elemento, 'Registrar pago')).toHaveLength(0);
      expect(elemento.querySelectorAll('th')).toHaveLength(6);
      expect(texto(elemento)).toContain('Pagado el 28/04/2027');
      expect(texto(elemento)).toContain('Comprobante: TRF-883412');
    });

    it('sin conexión el botón queda desactivado con «Requiere conexión» (104)', async () => {
      window.plataforma = {
        configuracion: { gatewayUrl: 'http://localhost:4000/graphql' },
        conexion: { enLinea: false, reportarFallo: () => undefined },
      } as never;
      const { elemento, esperar } = montar(() => of([PENDIENTE]), { puedeRegistrarPago: true });
      await esperar();
      expect(botones(elemento, 'Registrar pago')[0].disabled).toBe(true);
      expect(elemento.querySelector('app-requiere-conexion span')?.getAttribute('aria-label')).toBe(
        'Requiere conexión',
      );
    });

    it('la fecha es obligatoria y no puede ser futura ni anterior a la emisión (criterio 2)', async () => {
      const registrar = vi.fn(() => of(PAGADO));
      const { esperar } = await abrir({ registrar });
      const fecha = campo('Fecha de pago');
      const error = () => texto(dialogo()!.querySelector('mat-error'));
      const fueraDeRango =
        'La fecha de pago no puede ser futura ni anterior a la emisión del cobro.';

      escribir(fecha, '');
      botonDialogo('Registrar').click();
      await esperar();
      expect(error()).toBe('Obligatorio');

      escribir(fecha, '2027-04-01');
      await esperar();
      expect(error()).toBe(fueraDeRango);

      escribir(fecha, '2027-04-30');
      botonDialogo('Registrar').click();
      await esperar();
      expect(error()).toBe(fueraDeRango);
      expect(registrar).not.toHaveBeenCalled();

      // El día de la emisión es válido
      escribir(fecha, '2027-04-02');
      botonDialogo('Registrar').click();
      await esperar();
      expect(registrar).toHaveBeenCalledWith('c3', '2027-04-02', null);
    });

    it('el comprobante admite hasta 50 caracteres', async () => {
      const registrar = vi.fn(() => of(PAGADO));
      const { esperar } = await abrir({ registrar });
      const comprobante = campo('N.º de comprobante (opcional)');
      expect(comprobante.getAttribute('maxlength')).toBe('50');
      // Un valor puesto por código no lo corta el navegador: el validador lo detiene
      escribir(comprobante, 'x'.repeat(51));
      botonDialogo('Registrar').click();
      await esperar();
      expect(texto(dialogo()!.querySelector('mat-error'))).toBe('Hasta 50 caracteres');
      expect(registrar).not.toHaveBeenCalled();
      escribir(comprobante, 'x'.repeat(50));
      botonDialogo('Registrar').click();
      await esperar();
      expect(registrar).toHaveBeenCalledWith('c3', '2027-04-29', 'x'.repeat(50));
    });

    it('COBRO_YA_PAGADO cierra el diálogo, avisa «El cobro ya está pagado.» y recarga (criterio 4)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { elemento, servicio, avisos, esperar } = await abrir({
        registrar: () => throwError(() => errorDe('COBRO_YA_PAGADO', 409)),
      });
      botonDialogo('Registrar').click();
      await esperar();
      await vi.waitFor(() => expect(dialogo()).toBeNull());
      await esperar();
      expect(texto(elemento.querySelector('.aviso[role="alert"]'))).toBe(
        'El cobro ya está pagado.',
      );
      expect(servicio.cobros).toHaveBeenCalledTimes(2);
      expect(avisos).toEqual([]);
    });

    it('COBRO_NO_ENCONTRADO cierra el diálogo con «No se encontró el cobro.»', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { elemento, esperar } = await abrir({
        registrar: () => throwError(() => errorDe('COBRO_NO_ENCONTRADO', 404)),
      });
      botonDialogo('Registrar').click();
      await esperar();
      await vi.waitFor(() => expect(dialogo()).toBeNull());
      await esperar();
      expect(texto(elemento.querySelector('.aviso[role="alert"]'))).toBe(
        'No se encontró el cobro.',
      );
    });

    it('FECHA_PAGO_INVALIDA se muestra en el diálogo, que sigue abierto', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { servicio, esperar } = await abrir({
        registrar: () => throwError(() => errorDe('FECHA_PAGO_INVALIDA', 422)),
      });
      botonDialogo('Registrar').click();
      await esperar();
      const mensaje = 'La fecha de pago no puede ser futura ni anterior a la emisión del cobro.';
      expect(texto(dialogo()!.querySelector('.error[role="alert"]'))).toBe(mensaje);
      expect(texto(dialogo()!.querySelector('mat-error'))).toBe(mensaje);
      expect(botonDialogo('Registrar').disabled).toBe(false);
      expect(servicio.cobros).toHaveBeenCalledTimes(1);
    });

    it('sin respuesta del servidor muestra el texto de sin conexión en el diálogo', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { esperar } = await abrir({ registrar: () => throwError(() => new Error('red')) });
      botonDialogo('Registrar').click();
      await esperar();
      expect(texto(dialogo()!.querySelector('.error'))).toBe(
        'No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
      );
    });

    it('«Cancelar» cierra sin registrar ni recargar', async () => {
      const registrar = vi.fn(() => of(PAGADO));
      const { servicio, esperar } = await abrir({ registrar });
      botonDialogo('Cancelar').click();
      await esperar();
      await vi.waitFor(() => expect(dialogo()).toBeNull());
      expect(registrar).not.toHaveBeenCalled();
      expect(servicio.cobros).toHaveBeenCalledTimes(1);
    });
  });
});
