import { periodoActual, periodoDe, periodosDesde } from './periodos';

describe('periodos', () => {
  it('el mes actual se cuenta en hora de La Paz (UTC−4)', () => {
    expect(periodoActual(new Date('2026-11-01T03:59:00Z'))).toBe('2026-10');
    expect(periodoActual(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11');
    expect(periodoActual(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12');
  });

  it('lista los meses desde el inicio de la obra hasta el actual, el más reciente primero', () => {
    expect(periodosDesde('2026-11-15', '2027-02')).toEqual(['2027-02', '2027-01', '2026-12', '2026-11']);
    expect(periodosDesde('2026-10-01', '2026-10')).toEqual(['2026-10']);
  });

  it('una obra que todavía no empieza solo ofrece el mes actual', () => {
    expect(periodosDesde('2026-12-01', '2026-10')).toEqual(['2026-10']);
  });

  it('el periodo de un instante se cuenta en hora de La Paz', () => {
    expect(periodoDe('2026-12-01T03:30:00Z')).toBe('2026-11');
    expect(periodoDe('2026-12-01T04:00:00Z')).toBe('2026-12');
  });
});
