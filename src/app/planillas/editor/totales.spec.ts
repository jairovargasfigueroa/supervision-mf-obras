import { calcularLinea, calcularTotales, redondear } from './totales';

const LOSA = { cantidadContratada: 850, acumuladoAnterior: 300, precioUnitario: 420.5 };

describe('totales (ayuda visual de la planilla)', () => {
  it('redondea a 2 decimales mitad hacia arriba, sin ruido binario', () => {
    expect(redondear(0.045)).toBe(0.05);
    expect(redondear(1.005)).toBe(1.01);
    expect(redondear(2.344)).toBe(2.34);
    expect(redondear(-1.005)).toBe(-1.01);
    expect(redondear(0.0005, 3)).toBe(0.001);
  });

  it('calcula acumulado total, saldo y monto de la línea (criterio 3)', () => {
    expect(calcularLinea(LOSA, 120)).toEqual({
      cantidadPeriodo: 120,
      acumuladoTotal: 420,
      saldo: 430,
      saldoDisponible: 550,
      monto: 50460,
      supera: false,
    });
  });

  it('una cantidad vacía cuenta como 0', () => {
    expect(calcularLinea(LOSA, null)).toMatchObject({ cantidadPeriodo: 0, acumuladoTotal: 300, monto: 0 });
  });

  it('el borde exacto no supera lo contratado; una milésima más sí (criterio 5)', () => {
    expect(calcularLinea(LOSA, 550).supera).toBe(false);
    expect(calcularLinea(LOSA, 550.001)).toMatchObject({ supera: true, saldo: -0.001, saldoDisponible: 550 });
  });

  it('subtotal, anticipo 10 %, retención 7 % y neto, como el dominio (criterio 4)', () => {
    expect(calcularTotales([50460], 10, 7)).toEqual({
      subtotal: 50460,
      descuentoAnticipo: 5046,
      retencion: 3532.2,
      neto: 41881.8,
    });
    // 0,1 + 0,2 no deja restos; 3 × 33,33 = 99,99 → anticipo 10,00 (9,999), retención 7,00 (6,9993)
    expect(calcularTotales([0.1, 0.2], 10, 7).subtotal).toBe(0.3);
    expect(calcularTotales([33.33, 33.33, 33.33], 10, 7)).toEqual({
      subtotal: 99.99,
      descuentoAnticipo: 10,
      retencion: 7,
      neto: 82.99,
    });
  });

  it('sin cantidades el subtotal es 0', () => {
    expect(calcularTotales([0, 0], 10, 7)).toEqual({ subtotal: 0, descuentoAnticipo: 0, retencion: 0, neto: 0 });
  });
});
