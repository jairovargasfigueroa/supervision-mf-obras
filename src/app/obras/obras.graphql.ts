import { gql } from 'apollo-angular';

// Documentos GraphQL del área de obras (docs/contratos.md: consulta obras).

export type EstadoObra = 'SIN_CONTRATO' | 'EN_EJECUCION' | 'CONCLUIDA';

export interface ObraResumen {
  id: string;
  nombre: string;
  ubicacion: string;
  estado: EstadoObra;
  fechaInicio: string;
  avancePct: number;
  plazoPct: number;
  enRiesgo: boolean;
}

export const CONSULTA_OBRAS = gql<{ obras: ObraResumen[] }, { estado?: EstadoObra; busqueda?: string }>`
  query Obras($estado: EstadoObra, $busqueda: String) {
    obras(estado: $estado, busqueda: $busqueda) {
      id
      nombre
      ubicacion
      estado
      fechaInicio
      avancePct
      plazoPct
      enRiesgo
    }
  }
`;
