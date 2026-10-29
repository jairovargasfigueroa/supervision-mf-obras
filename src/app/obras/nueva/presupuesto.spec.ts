import { presupuestoCoincide, resumirPresupuesto, totalPartida, totalPresupuesto } from './presupuesto';

describe('presupuesto (002, criterios 5 y 6)', () => {
  it('el total de una partida es cantidad × precio unitario', () => {
    expect(totalPartida({ cantidadContratada: 850, precioUnitario: 420.5 })).toBe(357425);
  });

  it('una partida con datos incompletos suma 0', () => {
    expect(totalPartida({ cantidadContratada: null, precioUnitario: 420.5 })).toBe(0);
    expect(totalPartida({ cantidadContratada: 10, precioUnitario: undefined })).toBe(0);
  });

  it('suma todas las partidas y redondea a centavos', () => {
    const lineas = [
      { cantidadContratada: 850, precioUnitario: 420.5 },
      { cantidadContratada: 3, precioUnitario: 0.1 },
      { cantidadContratada: 1.5, precioUnitario: 33.333 },
    ];
    expect(totalPresupuesto(lineas)).toBe(357475.3);
    expect(totalPresupuesto([])).toBe(0);
  });

  it('la diferencia es total − monto: negativa si falta asignar, positiva si sobra', () => {
    expect(resumirPresupuesto([{ cantidadContratada: 850, precioUnitario: 420.5 }], 400000)).toEqual({
      total: 357425,
      monto: 400000,
      diferencia: -42575,
      coincide: false,
    });
    expect(resumirPresupuesto([{ cantidadContratada: 2, precioUnitario: 600 }], 1000).diferencia).toBe(200);
  });

  it('coincide con el monto: igual o con diferencia de hasta 0,01', () => {
    expect(presupuestoCoincide(357425, 357425)).toBe(true);
    expect(presupuestoCoincide(357425.01, 357425)).toBe(true);
    expect(presupuestoCoincide(357424.99, 357425)).toBe(true);
    expect(presupuestoCoincide(100.01, 100)).toBe(true);
  });

  it('no coincide si la diferencia pasa de 0,01', () => {
    expect(presupuestoCoincide(357425.02, 357425)).toBe(false);
    expect(presupuestoCoincide(357424.98, 357425)).toBe(false);
    expect(presupuestoCoincide(100.011, 100)).toBe(false);
  });

  it('compara la suma sin redondear: 0,014 de diferencia no coincide aunque se muestre 0,01', () => {
    const resumen = resumirPresupuesto([{ cantidadContratada: 1, precioUnitario: 100.014 }], 100);
    expect(resumen.total).toBe(100.01);
    expect(resumen.coincide).toBe(false);
  });

  it('sin monto todavía, el monto cuenta como 0', () => {
    expect(resumirPresupuesto([{ cantidadContratada: 1, precioUnitario: 5 }], null)).toMatchObject({
      monto: 0,
      diferencia: 5,
      coincide: false,
    });
  });

  it('no muestra −0 cuando la diferencia es nula', () => {
    expect(Object.is(resumirPresupuesto([{ cantidadContratada: 0.1, precioUnitario: 3 }], 0.3).diferencia, -0)).toBe(
      false,
    );
  });
});
