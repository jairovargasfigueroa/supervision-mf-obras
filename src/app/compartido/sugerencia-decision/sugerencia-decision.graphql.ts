import { gql } from 'apollo-angular';

// 502: sugerencias de los agentes y sus decisiones (SDL de docs/specs/502-agentes-erp/diseno.md, «Gateway»).

export type Agente = 'SEGUIMIENTO_OBRAS' | 'CONTROL_MATERIALES' | 'CONTROL_COBROS';
export type EstadoSugerencia = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface Sugerencia {
  id: string;
  ejecucionId: string;
  agente: Agente;
  obraId: string;
  obraNombre: string;
  accion: string;
  accionTexto: string;
  descripcion: string;
  estado: EstadoSugerencia;
  creadaEn: string;
  decididaPor: { id: string; nombre: string } | null;
  decididaEn: string | null;
  comentario: string | null;
}

/** Nombre visible de cada agente (502, «Los tres agentes»). */
export const NOMBRE_AGENTE: Record<Agente, string> = {
  SEGUIMIENTO_OBRAS: 'Seguimiento de obras',
  CONTROL_MATERIALES: 'Control de materiales',
  CONTROL_COBROS: 'Control de cobros',
};

export const CAMPOS_SUGERENCIA = `
  id
  ejecucionId
  agente
  obraId
  obraNombre
  accion
  accionTexto
  descripcion
  estado
  creadaEn
  decididaPor {
    id
    nombre
  }
  decididaEn
  comentario
`;

/** Aprobar solo registra la decisión (502, criterio 12). */
export const MUTACION_APROBAR_SUGERENCIA = gql<
  { aprobarSugerencia: Sugerencia },
  { id: string; comentario?: string }
>`
  mutation AprobarSugerencia($id: ID!, $comentario: String) {
    aprobarSugerencia(id: $id, comentario: $comentario) {
      ${CAMPOS_SUGERENCIA}
    }
  }
`;

export const MUTACION_RECHAZAR_SUGERENCIA = gql<
  { rechazarSugerencia: Sugerencia },
  { id: string; motivo: string }
>`
  mutation RechazarSugerencia($id: ID!, $motivo: String!) {
    rechazarSugerencia(id: $id, motivo: $motivo) {
      ${CAMPOS_SUGERENCIA}
    }
  }
`;
