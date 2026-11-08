// Cálculo del presupuesto (002, criterios 5 y 6). Funciones puras: el formulario las usa en vivo y Obras vuelve a
// validar la misma regla al guardar (PRESUPUESTO_NO_COINCIDE).

/** Tolerancia entre la suma de las partidas y el monto del contrato (criterio 6). */
export const TOLERANCIA_PRESUPUESTO = 0.01;

/** Margen para errores de coma flotante al comparar con la tolerancia (0,01 exacto debe aceptarse). */
const EPSILON = 1e-9;

export interface LineaPresupuesto {
  cantidadContratada: number | null | undefined;
  precioUnitario: number | null | undefined;
}

export interface ResumenPresupuesto {
  /** Σ cantidad × precio de las partidas. */
  total: number;
  monto: number;
  /** total − monto: positiva si las partidas superan el contrato, negativa si falta asignar. */
  diferencia: number;
  coincide: boolean;
}

/** Total de una partida (cantidad × precio unitario); 0 mientras falte un dato. */
export function totalPartida(linea: LineaPresupuesto): number {
  const cantidad = numero(linea.cantidadContratada);
  const precio = numero(linea.precioUnitario);
  return cantidad * precio;
}

/** Suma del presupuesto, redondeada a centavos para mostrar. */
export function totalPresupuesto(lineas: readonly LineaPresupuesto[]): number {
  return redondear(lineas.reduce((suma, linea) => suma + totalPartida(linea), 0));
}

/** ¿La suma coincide con el monto del contrato con tolerancia de 0,01? */
export function presupuestoCoincide(total: number, monto: number): boolean {
  return Math.abs(total - monto) <= TOLERANCIA_PRESUPUESTO + EPSILON;
}

export function resumirPresupuesto(
  lineas: readonly LineaPresupuesto[],
  monto: number | null | undefined,
): ResumenPresupuesto {
  // Se compara la suma sin redondear, como la compara Obras; el redondeo es solo para mostrar
  const suma = lineas.reduce((acumulado, linea) => acumulado + totalPartida(linea), 0);
  const montoContrato = numero(monto);
  return {
    total: redondear(suma),
    monto: montoContrato,
    diferencia: redondear(suma - montoContrato),
    coincide: presupuestoCoincide(suma, montoContrato),
  };
}

function numero(valor: number | null | undefined): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
}

function redondear(valor: number): number {
  // + 0 convierte −0 en 0 para no mostrar «Bs -0,00»
  return Math.round((valor + Number.EPSILON) * 100) / 100 + 0;
}
