import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';

// extensions.codigo → texto para el usuario (docs/mensajes.md de la carpeta general). Solo los códigos que puede
// recibir este microfrontend; uno desconocido usa el genérico de su estado HTTP.

/** Error del gateway ya leído: el primer error de `errors[]` (o un fallo de red). */
export interface ErrorLeido {
  codigo: string | null;
  estado: number | null;
  servicio: string | null;
  errores: { campo: string; mensaje: string }[];
  /** No hubo respuesta del servidor (sin conexión, gateway caído). */
  red: boolean;
}

const MENSAJES: Record<string, string> = {
  // Genéricos
  DATOS_INVALIDOS: 'Algunos datos no son válidos. Revisa los campos marcados.',
  NO_AUTENTICADO: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  SIN_PERMISO: 'No tienes permiso para hacer esta acción.',
  DEMASIADAS_PETICIONES: 'Hiciste muchas solicitudes seguidas. Espera un momento e intenta de nuevo.',
  ERROR_INTERNO: 'Ocurrió un error inesperado. Intenta de nuevo; si se repite, avisa a soporte.',
  SERVICIO_NO_DISPONIBLE: 'Este servicio no está disponible por el momento. Intenta de nuevo en unos minutos.',
  TIEMPO_AGOTADO: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  // Obras
  PRESUPUESTO_NO_COINCIDE: 'El presupuesto (Bs {presupuesto}) no coincide con el monto del contrato (Bs {monto})',
  CODIGO_PARTIDA_REPETIDO: 'Hay partidas con el mismo código ({codigo}). Cada partida debe tener un código distinto.',
  INSUMO_REPETIDO: 'La partida {codigo} tiene el mismo material más de una vez.',
  CONTRATO_INVALIDO:
    'Los datos del contrato no son válidos: el monto y el plazo deben ser mayores a 0, y el anticipo y la retención deben estar entre 0 y 100 y sumar menos de 100.',
  OBRA_NO_ENCONTRADA: 'Obra no encontrada',
};

const GENERICOS_POR_ESTADO: Record<number, string> = {
  400: MENSAJES['DATOS_INVALIDOS'],
  401: MENSAJES['NO_AUTENTICADO'],
  403: MENSAJES['SIN_PERMISO'],
  404: 'No encontramos lo que buscas. Puede que ya no exista o que no tengas acceso.',
  409: 'Los datos cambiaron mientras trabajabas. Recarga para ver la última versión.',
  422: 'No se pudo completar la operación porque no cumple una regla del sistema.',
  429: MENSAJES['DEMASIADAS_PETICIONES'],
  503: MENSAJES['SERVICIO_NO_DISPONIBLE'],
  504: MENSAJES['TIEMPO_AGOTADO'],
};

export const MENSAJE_SIN_CONEXION =
  'No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.';

/** Lee el error que entrega Apollo (errores GraphQL con extensions, error HTTP o fallo de red). */
export function leerError(error: unknown): ErrorLeido {
  if (CombinedGraphQLErrors.is(error)) {
    const extensiones = (error.errors[0]?.extensions ?? {}) as Record<string, unknown>;
    return {
      codigo: typeof extensiones['codigo'] === 'string' ? extensiones['codigo'] : null,
      estado: typeof extensiones['estado'] === 'number' ? extensiones['estado'] : null,
      servicio: typeof extensiones['servicio'] === 'string' ? extensiones['servicio'] : null,
      errores: Array.isArray(extensiones['errores']) ? (extensiones['errores'] as ErrorLeido['errores']) : [],
      red: false,
    };
  }
  if (ServerError.is(error)) {
    return { codigo: null, estado: error.statusCode, servicio: 'gateway', errores: [], red: false };
  }
  return { codigo: null, estado: null, servicio: null, errores: [], red: true };
}

/**
 * Texto para el usuario. Los marcadores ({presupuesto}, {monto}, {codigo}) se completan con `datos`; si falta uno,
 * se usa la frase sin esa parte (docs/mensajes.md, «Cómo se usa»).
 */
export function mensajeDeError(error: ErrorLeido, datos: Record<string, string> = {}): string {
  if (error.red) return MENSAJE_SIN_CONEXION;
  const plantilla =
    (error.codigo ? MENSAJES[error.codigo] : undefined) ??
    (error.estado ? GENERICOS_POR_ESTADO[error.estado] : undefined) ??
    (error.estado && error.estado >= 500 ? MENSAJES['ERROR_INTERNO'] : GENERICOS_POR_ESTADO[422]);
  return completar(plantilla, datos);
}

/**
 * El gateway todavía no expone el campo pedido: el esquema rechaza la consulta (`GRAPHQL_VALIDATION_FAILED` de Apollo
 * Server, o un 400 sin cuerpo GraphQL). Sirve para mostrar el estado vacío en una sección que llega con otra
 * funcionalidad (por ejemplo `planillas`, de la 007) en lugar de un error.
 */
export function esCampoNoExpuesto(error: unknown): boolean {
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.some((e) => e.extensions?.['code'] === 'GRAPHQL_VALIDATION_FAILED');
  }
  return ServerError.is(error) && error.statusCode === 400;
}

/** El código y el servicio van a la consola para soporte; nunca al usuario. */
export function registrarError(contexto: string, error: ErrorLeido): void {
  console.error(`[mf-obras] ${contexto}`, { codigo: error.codigo, servicio: error.servicio, estado: error.estado });
}

function completar(plantilla: string, datos: Record<string, string>): string {
  return plantilla
    .replace(/ ?\(?(Bs )?\{(\w+)\}\)?/g, (parte, _bs, clave: string) =>
      datos[clave] !== undefined ? parte.replace(`{${clave}}`, datos[clave]) : '',
    )
    .trim();
}
