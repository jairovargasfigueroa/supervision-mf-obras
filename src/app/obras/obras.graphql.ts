import { gql } from 'apollo-angular';

// Documentos GraphQL del área de obras (docs/contratos.md): obras, obra, usuarios y registrarObra.

export type EstadoObra = 'SIN_CONTRATO' | 'EN_EJECUCION' | 'CONCLUIDA';

export type Rol = 'admin' | 'residente' | 'gerente' | 'maestro' | 'almacenero' | 'cliente';

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

export interface Usuario {
  id: string;
  nombre: string;
  correo: string | null;
}

export interface Partida {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  cantidadContratada: number;
  precioUnitario: number;
  meses: string | null;
}

/** Detalle básico de la obra (002). La 006 agrega avance, material, fotos, planillas y cobros. */
export interface Obra {
  id: string;
  nombre: string;
  ubicacion: string;
  estado: EstadoObra;
  fechaInicio: string;
  motivoRechazoContrato: string | null;
  residente: Usuario | null;
  maestro: Usuario | null;
  almacenero: Usuario | null;
  cliente: Usuario | null;
  contrato: { contratoId: string | null; monto: number; plazoDias: number; anticipoPct: number; retencionPct: number };
  partidas: Partida[];
}

export interface RegistrarObraEntrada {
  nombre: string;
  ubicacion: string;
  fechaInicio: string;
  asignaciones: { residenteId: string; maestroId: string; almaceneroId: string; clienteId: string };
  contrato: { monto: number; plazoDias: number; anticipoPct: number; retencionPct: number; firmadoEn: string };
  partidas: {
    codigo: string;
    nombre: string;
    unidad: string;
    cantidadContratada: number;
    precioUnitario: number;
    meses?: string | null;
    insumos?: { materialId: string; cantidadPorUnidad: number }[];
  }[];
}

/** Filtros de la lista (006, criterio 2); un filtro vacío no se manda. */
export interface FiltrosObras {
  estado?: EstadoObra;
  busqueda?: string;
}

export const CONSULTA_OBRAS = gql<{ obras: ObraResumen[] }, FiltrosObras>`
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

export const CONSULTA_USUARIOS = gql<{ usuarios: Usuario[] }, { rol: Rol }>`
  query Usuarios($rol: Rol!) {
    usuarios(rol: $rol) {
      id
      nombre
      correo
    }
  }
`;

export const CONSULTA_OBRA = gql<{ obra: Obra | null }, { id: string }>`
  query Obra($id: ID!) {
    obra(id: $id) {
      id
      nombre
      ubicacion
      estado
      fechaInicio
      motivoRechazoContrato
      residente { id nombre correo }
      maestro { id nombre correo }
      almacenero { id nombre correo }
      cliente { id nombre correo }
      contrato { contratoId monto plazoDias anticipoPct retencionPct }
      partidas { id codigo nombre unidad cantidadContratada precioUnitario meses }
    }
  }
`;

/** Devuelve solo el id y el estado: el detalle se consulta después en /obras/{id}. */
export const MUTACION_REGISTRAR_OBRA = gql<
  { registrarObra: { id: string; estado: EstadoObra } },
  { entrada: RegistrarObraEntrada }
>`
  mutation RegistrarObra($entrada: RegistrarObraEntrada!) {
    registrarObra(entrada: $entrada) {
      id
      estado
    }
  }
`;
