import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { MENSAJE_SIN_CONEXION, leerError, mensajeDeError, type ErrorLeido } from './errores';

const error = (codigo: string | null, estado: number | null = 422): ErrorLeido => ({
  codigo,
  estado,
  servicio: 'obras',
  errores: [],
  red: false,
});

describe('errores (extensions.codigo → docs/mensajes.md)', () => {
  it('PRESUPUESTO_NO_COINCIDE con los montos en pantalla (texto del criterio 6)', () => {
    expect(mensajeDeError(error('PRESUPUESTO_NO_COINCIDE'), { presupuesto: '357.425,00', monto: '400.000,00' })).toBe(
      'El presupuesto (Bs 357.425,00) no coincide con el monto del contrato (Bs 400.000,00)',
    );
  });

  it('sin el dato de un marcador usa la frase sin esa parte', () => {
    expect(mensajeDeError(error('CODIGO_PARTIDA_REPETIDO'))).toBe(
      'Hay partidas con el mismo código. Cada partida debe tener un código distinto.',
    );
    expect(mensajeDeError(error('CODIGO_PARTIDA_REPETIDO'), { codigo: 'P-01' })).toBe(
      'Hay partidas con el mismo código (P-01). Cada partida debe tener un código distinto.',
    );
    expect(mensajeDeError(error('INSUMO_REPETIDO'))).toBe('La partida tiene el mismo material más de una vez.');
  });

  it('un código desconocido usa el genérico de su estado', () => {
    expect(mensajeDeError(error('OTRO_CODIGO', 422))).toBe(
      'No se pudo completar la operación porque no cumple una regla del sistema.',
    );
    expect(mensajeDeError(error(null, 502))).toBe(
      'Ocurrió un error inesperado. Intenta de nuevo; si se repite, avisa a soporte.',
    );
  });

  it('lee codigo, estado, servicio y errores del primer error GraphQL', () => {
    const leido = leerError(
      new CombinedGraphQLErrors({
        data: null,
        errors: [
          {
            message: 'x',
            extensions: { codigo: 'SIN_PERMISO', servicio: 'gateway', estado: 403, errores: [{ campo: 'a', mensaje: 'b' }] },
          },
        ],
      }),
    );
    expect(leido).toEqual({
      codigo: 'SIN_PERMISO',
      estado: 403,
      servicio: 'gateway',
      errores: [{ campo: 'a', mensaje: 'b' }],
      red: false,
    });
    expect(mensajeDeError(leido)).toBe('No tienes permiso para hacer esta acción.');
  });

  it('un error HTTP sin cuerpo GraphQL usa el genérico de su estado', () => {
    const leido = leerError(new ServerError('x', { response: new Response('', { status: 503 }), bodyText: '' }));
    expect(mensajeDeError(leido)).toBe(
      'Este servicio no está disponible por el momento. Intenta de nuevo en unos minutos.',
    );
  });

  it('sin respuesta del servidor muestra el mensaje de conexión', () => {
    expect(mensajeDeError(leerError(new TypeError('Failed to fetch')))).toBe(MENSAJE_SIN_CONEXION);
  });
});
