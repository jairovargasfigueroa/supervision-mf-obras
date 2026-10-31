// Formatos de docs/diseno-visual.md («Formatos»): locale es-BO y hora de La Paz.
const LOCALE = 'es-BO';
const ZONA_NEGOCIO = 'America/La_Paz';

const montos = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const cantidades = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 });
const porcentajes = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const fechas = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA_NEGOCIO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const fechasHoras = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA_NEGOCIO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `Bs 1.250.000,00` */
export function formatearMonto(monto: number): string {
  return `Bs ${formatearImporte(monto)}`;
}

/** `1.250.000,00` (sin «Bs», para mensajes que ya lo traen: «el presupuesto (Bs {presupuesto})»). */
export function formatearImporte(monto: number): string {
  return montos.format(monto);
}

/** `120,5 m²` (hasta 3 decimales). */
export function formatearCantidad(cantidad: number, unidad: string): string {
  return `${formatearNumero(cantidad)} ${unidad}`;
}

/** `1.234,568` (hasta 3 decimales, sin unidad: para tablas que muestran la unidad en su propia columna). */
export function formatearNumero(cantidad: number): string {
  return cantidades.format(cantidad);
}

/** `32,5 %` */
export function formatearPorcentaje(porcentaje: number): string {
  return `${porcentajes.format(porcentaje)} %`;
}

/** `15/11/2026`. Recibe una fecha sin hora (`2026-11-15`) o un instante ISO (se muestra en hora de La Paz). */
export function formatearFecha(fecha: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [anio, mes, dia] = fecha.split('-');
    return `${dia}/${mes}/${anio}`;
  }
  return fechas.format(new Date(fecha));
}

const meses = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'long' });

/** `Noviembre 2026` para el periodo `2026-11`. */
export function formatearPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const nombre = meses.format(new Date(Date.UTC(anio, mes - 1, 1)));
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

/** `15/11/2026 14:30` en hora de La Paz. */
export function formatearFechaHora(instante: string): string {
  return fechasHoras.format(new Date(instante)).replace(', ', ' ');
}

const diasHoras = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA_NEGOCIO,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `15/11 14:30` en hora de La Paz (borrador local de la 104). */
export function formatearDiaHora(instante: string): string {
  return diasHoras.format(new Date(instante)).replace(', ', ' ');
}
