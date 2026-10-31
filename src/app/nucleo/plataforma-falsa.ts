// Solo para las pruebas: window.plataforma con conexión y almacén en memoria, como lo publica el shell (104).
import {
  EVENTO_BORRADORES,
  EVENTO_CONEXION,
  type AlmacenPlataforma,
  type BorradorPlanilla,
  type UsuarioSesion,
} from './sesion.service';

export interface PlataformaFalsa {
  consultas: Map<string, { datos: unknown; guardadoEn: string }>;
  borradores: Map<string, BorradorPlanilla>;
  fallosReportados: number;
  cambiarConexion(enLinea: boolean): void;
}

/** Publica en window.plataforma una sesión, la conexión y un almacén en memoria. */
export function instalarPlataformaFalsa(
  opciones: { enLinea?: boolean; usuario?: UsuarioSesion; sinAlmacen?: boolean } = {},
): PlataformaFalsa {
  const falsa: PlataformaFalsa = {
    consultas: new Map(),
    borradores: new Map(),
    fallosReportados: 0,
    cambiarConexion(enLinea) {
      estado.enLinea = enLinea;
      window.dispatchEvent(new CustomEvent(EVENTO_CONEXION, { detail: { enLinea } }));
    },
  };
  const estado = { enLinea: opciones.enLinea ?? true };
  const avisarBorradores = () => window.dispatchEvent(new Event(EVENTO_BORRADORES));
  const almacen: AlmacenPlataforma = {
    guardarConsulta: async (clave, datos) => {
      falsa.consultas.set(clave, {
        datos: structuredClone(datos),
        guardadoEn: new Date().toISOString(),
      });
    },
    leerConsulta: async <T>(clave: string) =>
      (falsa.consultas.get(clave) as { datos: T; guardadoEn: string } | undefined) ?? null,
    guardarBorradorPlanilla: async (borrador) => {
      falsa.borradores.set(borrador.planillaId, structuredClone(borrador));
      avisarBorradores();
    },
    leerBorradorPlanilla: async (id) => structuredClone(falsa.borradores.get(id)) ?? null,
    listarBorradoresPlanilla: async () =>
      [...falsa.borradores.values()].map((b) => structuredClone(b)),
    borrarBorradorPlanilla: async (id) => {
      falsa.borradores.delete(id);
      avisarBorradores();
    },
  };
  const usuario = opciones.usuario ?? {
    id: 'u-residente',
    nombre: 'Residente',
    roles: ['residente'],
  };
  window.plataforma = {
    configuracion: { gatewayUrl: 'http://gateway.test/graphql' },
    sesion: {
      usuario,
      obtenerToken: () =>
        estado.enLinea ? Promise.resolve('token') : Promise.reject(new Error('SIN_CONEXION')),
      cerrarSesion: () => undefined,
      sinConexion: false,
    },
    conexion: {
      get enLinea() {
        return estado.enLinea;
      },
      reportarFallo: () => {
        falsa.fallosReportados++;
        falsa.cambiarConexion(false);
      },
    },
    almacen: opciones.sinAlmacen ? undefined : almacen,
  };
  return falsa;
}
