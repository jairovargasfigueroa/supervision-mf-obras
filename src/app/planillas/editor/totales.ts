// Cálculo de la planilla mientras se escribe (007, criterios 3 a 5): el mismo del dominio de Obras
// (docs/reglas-negocio.md, «Planilla de avance»), solo como ayuda visual. Manda lo que devuelve el servicio.
import type { LineaPlanilla } from '../planillas.graphql';

/** Redondeo «mitad hacia arriba» (lejos del cero), como HALF_UP de Obras (docs/convenciones.md). */
export function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  // toPrecision quita el ruido binario: 0,045 × 100 da 4,4999…, que debe subir a 5
  const escalado = Number((Math.abs(valor) * factor).toPrecision(15));
  return (Math.sign(valor) * Math.round(escalado)) / factor || 0;
}

export type LineaBase = Pick<LineaPlanilla, 'cantidadContratada' | 'acumuladoAnterior' | 'precioUnitario'>;

export interface LineaCalculada {
  cantidadPeriodo: number;
  /** acumulado anterior + cantidad del periodo (3 decimales). */
  acumuladoTotal: number;
  /** Saldo por ejecutar: contratada − acumulado total (negativo si supera). */
  saldo: number;
  /** Lo más que se puede medir en el periodo: contratada − acumulado anterior (el «saldo» del mensaje). */
  saldoDisponible: number;
  /** cantidad × precio unitario (2 decimales). */
  monto: number;
  /** El acumulado supera lo contratado (criterio 5). */
  supera: boolean;
}

/** Una cantidad vacía cuenta como 0; las cantidades se llevan a 3 decimales (docs/convenciones.md). */
export function calcularLinea(linea: LineaBase, cantidad: number | null): LineaCalculada {
  const cantidadPeriodo = redondear(cantidad ?? 0, 3);
  const acumuladoTotal = redondear(linea.acumuladoAnterior + cantidadPeriodo, 3);
  return {
    cantidadPeriodo,
    acumuladoTotal,
    saldo: redondear(linea.cantidadContratada - acumuladoTotal, 3),
    saldoDisponible: redondear(linea.cantidadContratada - linea.acumuladoAnterior, 3),
    monto: redondear(cantidadPeriodo * linea.precioUnitario, 2),
    supera: acumuladoTotal > linea.cantidadContratada,
  };
}

export interface Totales {
  subtotal: number;
  descuentoAnticipo: number;
  retencion: number;
  neto: number;
}

/**
 * subtotal = Σ montos; descuento por anticipo = subtotal × anticipo %; retención = subtotal × retención %;
 * neto = subtotal − descuento − retención. Cada monto se redondea a 2 decimales al final (criterio 4).
 */
export function calcularTotales(montos: number[], anticipoPct: number, retencionPct: number): Totales {
  const subtotal = redondear(montos.reduce((suma, monto) => suma + monto, 0), 2);
  const descuentoAnticipo = redondear((subtotal * anticipoPct) / 100, 2);
  const retencion = redondear((subtotal * retencionPct) / 100, 2);
  return { subtotal, descuentoAnticipo, retencion, neto: redondear(subtotal - descuentoAnticipo - retencion, 2) };
}
