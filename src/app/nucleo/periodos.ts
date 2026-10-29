// Periodos mensuales `AAAA-MM` (planillas y material del periodo), contados en hora de La Paz.
const ZONA_NEGOCIO = 'America/La_Paz';

const anioMes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_NEGOCIO, year: 'numeric', month: '2-digit' });

/** Mes actual en La Paz (`2026-10`). */
export function periodoActual(ahora: Date = new Date()): string {
  const partes = anioMes.formatToParts(ahora);
  const anio = partes.find((parte) => parte.type === 'year')!.value;
  const mes = partes.find((parte) => parte.type === 'month')!.value;
  return `${anio}-${mes}`;
}

/**
 * Meses desde el de `fechaInicio` (`AAAA-MM-DD`) hasta `hasta`, del más reciente al más antiguo. Si la obra todavía
 * no empezó, solo `hasta`.
 */
export function periodosDesde(fechaInicio: string, hasta: string): string[] {
  const desde = fechaInicio.slice(0, 7);
  const periodos: string[] = [];
  let [anio, mes] = hasta.split('-').map(Number);
  let actual = hasta;
  while (actual >= desde || periodos.length === 0) {
    periodos.push(actual);
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      anio -= 1;
    }
    actual = `${anio}-${String(mes).padStart(2, '0')}`;
  }
  return periodos;
}

/** Mes en La Paz (`AAAA-MM`) de un instante ISO: una foto de las 23:30 del 31 en La Paz es de ese mes, no del siguiente. */
export function periodoDe(instante: string): string {
  return periodoActual(new Date(instante));
}
