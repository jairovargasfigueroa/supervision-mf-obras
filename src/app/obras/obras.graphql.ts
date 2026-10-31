import { gql } from 'apollo-angular';

// Documentos GraphQL del área de obras (docs/contratos.md): obras, obra (y las secciones del detalle), usuarios y
// registrarObra.

export type EstadoObra = 'SIN_CONTRATO' | 'EN_EJECUCION' | 'CONCLUIDA';
export type EstadoPlanilla = 'BORRADOR' | 'PRESENTADA' | 'APROBANDO' | 'APROBADA' | 'OBSERVADA';
export type EstadoCobro = 'PENDIENTE' | 'VENCIDO';

export type Rol = 'admin' | 'residente' | 'gerente' | 'maestro' | 'almacenero' | 'cliente';

/** Zona de la obra (401, decisión del equipo); opcional: null = «Sin zona». */
export type ZonaObra = 'NORTE' | 'SUR' | 'ESTE' | 'OESTE' | 'CENTRO';

export interface ObraResumen {
  id: string;
  nombre: string;
  ubicacion: string;
  /** 401 */
  zona: ZonaObra | null;
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
  /** 401 */
  zona: ZonaObra | null;
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

/** Lo que el detalle usa del material del catálogo. */
export interface MaterialCorto {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  unidadPlural: string;
}

/** Material usado frente al previsto de una partida en el periodo (006, criterios 3 y 5). */
export interface FilaComparacion {
  partidaId: string;
  partidaCodigo: string;
  material: MaterialCorto;
  previsto: number;
  usado: number;
  /** usado − previsto (la calcula el gateway). */
  diferencia: number;
  /** usado > 1,20 × previsto (lo calcula el gateway). */
  excedido: boolean;
}

export interface ComparacionMaterial {
  periodo: string;
  hayPlanilla: boolean;
  filas: FilaComparacion[];
}

/** Foto de avance (005); la URL firmada vence a los 30 minutos. */
export interface Foto {
  id: string;
  partidaId: string;
  registradoPor: Pick<Usuario, 'id' | 'nombre'> | null;
  registradoEn: string;
  urlDescarga: string;
}

export interface FotosPagina {
  items: Foto[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface PlanillaResumen {
  id: string;
  numero: number;
  periodo: string;
  estado: EstadoPlanilla;
  neto: number;
  /** Número del cobro (`COB-AAAA-NNNN`) que Obras guarda al aprobarse la planilla (008); null hasta entonces. */
  cobroNumero: string | null;
}

export interface Cobro {
  id: string;
  numero: string;
  planillaId: string;
  montoNeto: number;
  emitidoEn: string;
  venceEn: string;
  estado: EstadoCobro;
}

export interface RegistrarObraEntrada {
  nombre: string;
  ubicacion: string;
  /** 401: se omite si no se eligió. */
  zona?: ZonaObra;
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
      zona
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
      zona
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

// Una consulta por pestaña del detalle: cada una se pide al abrirla y maneja su propio error (006, criterio 4).

/** `null` con el error del servicio (Obras o Materiales) si alguno no responde. */
export const CONSULTA_MATERIAL_COMPARADO = gql<
  { obra: { id: string; materialComparado: ComparacionMaterial | null } | null },
  { id: string; periodo: string }
>`
  query MaterialComparado($id: ID!, $periodo: String!) {
    obra(id: $id) {
      id
      materialComparado(periodo: $periodo) {
        periodo
        hayPlanilla
        filas {
          partidaId
          partidaCodigo
          material { id codigo nombre unidad unidadPlural }
          previsto
          usado
          diferencia
          excedido
        }
      }
    }
  }
`;

export const CONSULTA_FOTOS = gql<
  { obra: { id: string; fotos: FotosPagina } | null },
  { id: string; pagina: number; tamano: number }
>`
  query FotosObra($id: ID!, $pagina: Int!, $tamano: Int!) {
    obra(id: $id) {
      id
      fotos(pagina: $pagina, tamano: $tamano) {
        items {
          id
          partidaId
          registradoPor { id nombre }
          registradoEn
          urlDescarga
        }
        total
        pagina
        tamano
      }
    }
  }
`;

/** 007: el gateway la expone cuando Obras tenga `GET /obras/{id}/planillas`. */
export const CONSULTA_PLANILLAS = gql<{ obra: { id: string; planillas: PlanillaResumen[] } | null }, { id: string }>`
  query PlanillasObra($id: ID!) {
    obra(id: $id) {
      id
      planillas { id numero periodo estado neto cobroNumero }
    }
  }
`;

/** `null` sin error si el rol no es admin ni gerente. */
export const CONSULTA_COBROS = gql<{ obra: { id: string; cobros: Cobro[] | null } | null }, { id: string }>`
  query CobrosObra($id: ID!) {
    obra(id: $id) {
      id
      cobros { id numero planillaId montoNeto emitidoEn venceEn estado }
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
