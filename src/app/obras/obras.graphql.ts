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
  /** Suma de lo aprobado en planillas (006). */
  ejecutadaAcumulada: number;
  avancePct: number;
}

/**
 * Encabezado, indicadores, contrato y partidas de la obra (002 y 006). Material, fotos, planillas, cobros y finanzas
 * se piden aparte, cada uno al abrir su sección (006, diseño).
 */
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
  avancePct: number;
  plazoPct: number;
  enRiesgo: boolean;
  partidas: Partida[];
}

/** Saldo y cobros del contrato (Finanzas); solo para admin y gerente (006, criterio 3). */
export interface FinanzasObra {
  saldoDisponible: number;
  totalCobrado: number;
  totalReservado: number;
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
      avancePct
      plazoPct
      enRiesgo
      partidas { id codigo nombre unidad cantidadContratada precioUnitario meses ejecutadaAcumulada avancePct }
    }
  }
`;

/** Finanzas de la obra: `null` sin error si el rol no es admin ni gerente; con SERVICIO_NO_DISPONIBLE si no responde. */
export const CONSULTA_FINANZAS_OBRA = gql<{ obra: { id: string; finanzas: FinanzasObra | null } | null }, { id: string }>`
  query FinanzasObra($id: ID!) {
    obra(id: $id) {
      id
      finanzas { saldoDisponible totalCobrado totalReservado }
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
