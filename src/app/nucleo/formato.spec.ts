import {
  formatearCantidad,
  formatearFecha,
  formatearFechaHora,
  formatearMonto,
  formatearPorcentaje,
} from './formato';

describe('formato', () => {
  it('formatea montos en bolivianos con 2 decimales', () => {
    expect(formatearMonto(1250000)).toBe('Bs 1.250.000,00');
    expect(formatearMonto(1250)).toBe('Bs 1.250,00');
    expect(formatearMonto(0.5)).toBe('Bs 0,50');
  });

  it('formatea cantidades con hasta 3 decimales y la unidad', () => {
    expect(formatearCantidad(120.5, 'm²')).toBe('120,5 m²');
    expect(formatearCantidad(1234.5678, 'kg')).toBe('1.234,568 kg');
  });

  it('formatea porcentajes', () => {
    expect(formatearPorcentaje(32.5)).toBe('32,5 %');
    expect(formatearPorcentaje(100)).toBe('100 %');
  });

  it('formatea fechas sin hora sin cambiar el día', () => {
    expect(formatearFecha('2026-11-15')).toBe('15/11/2026');
  });

  it('formatea instantes en hora de La Paz (UTC−4)', () => {
    expect(formatearFecha('2026-11-16T02:00:00Z')).toBe('15/11/2026');
    expect(formatearFechaHora('2026-11-15T18:30:00Z')).toBe('15/11/2026 14:30');
  });
});
