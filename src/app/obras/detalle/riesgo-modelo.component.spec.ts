import type { RiesgoRetraso } from '../obras.graphql';
import { porcentajeRiesgo, textoFactores, valorRiesgo } from './riesgo-modelo.component';

const RIESGO: RiesgoRetraso = {
  probabilidad: 0.3,
  nivel: 'MEDIO',
  factores: [
    { variable: 'plazo_pct', descripcion: 'Ya transcurrió 60 % del plazo', peso: 0.3 },
    { variable: 'avance_pct', descripcion: 'El avance es de solo 40 %', peso: 0.2 },
  ],
  versionModelo: 'rr-1.0.0',
  calculadaEn: '2026-11-15T05:00:00Z',
};

describe('riesgo del modelo (402)', () => {
  it('porcentajeRiesgo redondea la probabilidad a un porcentaje entero', () => {
    expect(porcentajeRiesgo(0.7234)).toBe('72 %');
    expect(porcentajeRiesgo(0.6)).toBe('60 %');
    expect(porcentajeRiesgo(0.005)).toBe('1 %');
    expect(porcentajeRiesgo(0)).toBe('0 %');
  });

  it('valorRiesgo: nivel y porcentaje, «Sin datos suficientes» o «—» sin IA (criterios 2, 10 y 12)', () => {
    expect(valorRiesgo(RIESGO)).toBe('MEDIO · 30 %');
    expect(valorRiesgo({ ...RIESGO, nivel: 'SIN_DATOS', probabilidad: null, factores: [] })).toBe(
      'Sin datos suficientes',
    );
    expect(valorRiesgo(null)).toBe('—');
  });

  it('textoFactores: un factor por línea; nada con SIN_DATOS o sin IA', () => {
    expect(textoFactores(RIESGO)).toBe('Ya transcurrió 60 % del plazo\nEl avance es de solo 40 %');
    expect(textoFactores({ ...RIESGO, factores: [] })).toBe('');
    expect(textoFactores({ ...RIESGO, nivel: 'SIN_DATOS' })).toBe('');
    expect(textoFactores(null)).toBe('');
  });
});
