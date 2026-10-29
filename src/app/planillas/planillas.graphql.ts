import { gql } from 'apollo-angular';
import type { EstadoObra, EstadoPlanilla, Usuario } from '../obras/obras.graphql';

// Documentos GraphQL de las planillas (007, docs/contratos.md): planilla(id), crearPlanilla, guardarPlanilla y
// presentarPlanilla, más lo que el editor necesita de la obra.

/** Una línea por partida de la obra; la calcula Obras (manda lo que devuelve el servicio). */
export interface LineaPlanilla {
  partidaId: string;
  codigo: string;
  nombre: string;
  unidad: string;
  precioUnitario: number;
  cantidadContratada: number;
  /** Ejecutada acumulada de la partida en planillas aprobadas. */
  acumuladoAnterior: number;
  cantidadPeriodo: number;
  acumuladoTotal: number;
  /** Saldo por ejecutar: contratada − acumulado total. */
  saldo: number;
  monto: number;
}

export interface Planilla {
  id: string;
  obraId: string;
  numero: number;
  periodo: string;
  estado: EstadoPlanilla;
  /** Bloqueo optimista: se manda al guardar y al presentar. */
  version: number;
  lineas: LineaPlanilla[];
  subtotal: number;
  descuentoAnticipo: number;
  retencion: number;
  neto: number;
  anticipoPct: number;
  retencionPct: number;
  observacion: string | null;
  fotoIds: string[];
}

export interface GuardarPlanillaEntrada {
  version: number;
  lineas: { partidaId: string; cantidadPeriodo: number }[];
  fotoIds: string[];
}

/** Lo que la planilla usa de su obra: nombre (migas), estado, inicio (meses) y residente (quién la elabora). */
export interface ObraDePlanilla {
  id: string;
  nombre: string;
  estado: EstadoObra;
  fechaInicio: string;
  residente: Pick<Usuario, 'id' | 'nombre'> | null;
}

const CAMPOS_PLANILLA = `
  id
  obraId
  numero
  periodo
  estado
  version
  lineas {
    partidaId
    codigo
    nombre
    unidad
    precioUnitario
    cantidadContratada
    acumuladoAnterior
    cantidadPeriodo
    acumuladoTotal
    saldo
    monto
  }
  subtotal
  descuentoAnticipo
  retencion
  neto
  anticipoPct
  retencionPct
  observacion
  fotoIds
`;

/** `null` con el código de Obras si no existe o el usuario no ve su obra. */
export const CONSULTA_PLANILLA = gql<{ planilla: Planilla | null }, { id: string }>`
  query Planilla($id: ID!) {
    planilla(id: $id) {
      ${CAMPOS_PLANILLA}
    }
  }
`;

export const CONSULTA_OBRA_DE_PLANILLA = gql<{ obra: ObraDePlanilla | null }, { id: string }>`
  query ObraDePlanilla($id: ID!) {
    obra(id: $id) {
      id
      nombre
      estado
      fechaInicio
      residente { id nombre }
    }
  }
`;

export const MUTACION_CREAR_PLANILLA = gql<{ crearPlanilla: Planilla }, { obraId: string; periodo: string }>`
  mutation CrearPlanilla($obraId: ID!, $periodo: String!) {
    crearPlanilla(obraId: $obraId, periodo: $periodo) {
      ${CAMPOS_PLANILLA}
    }
  }
`;

export const MUTACION_GUARDAR_PLANILLA = gql<
  { guardarPlanilla: Planilla },
  { id: string; entrada: GuardarPlanillaEntrada }
>`
  mutation GuardarPlanilla($id: ID!, $entrada: GuardarPlanillaEntrada!) {
    guardarPlanilla(id: $id, entrada: $entrada) {
      ${CAMPOS_PLANILLA}
    }
  }
`;

export const MUTACION_PRESENTAR_PLANILLA = gql<{ presentarPlanilla: Planilla }, { id: string; version: number }>`
  mutation PresentarPlanilla($id: ID!, $version: Int!) {
    presentarPlanilla(id: $id, version: $version) {
      ${CAMPOS_PLANILLA}
    }
  }
`;
