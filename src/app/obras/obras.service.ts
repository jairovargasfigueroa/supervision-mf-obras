import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, type Observable } from 'rxjs';
import {
  CONSULTA_COBROS,
  CONSULTA_CONSUMOS_ATIPICOS,
  CONSULTA_FINANZAS_OBRA,
  CONSULTA_FOTOS,
  CONSULTA_MATERIAL_COMPARADO,
  CONSULTA_OBRA,
  CONSULTA_OBRAS,
  CONSULTA_PLANILLAS,
  CONSULTA_USUARIOS,
  MUTACION_REGISTRAR_OBRA,
  MUTACION_REVISAR_CONSUMO_ATIPICO,
  type Cobro,
  type ComparacionMaterial,
  type ConsumoAtipico,
  type EstadoRevision,
  type EstadoObra,
  type FiltrosObras,
  type FinanzasObra,
  type FotosPagina,
  type Obra,
  type ObraResumen,
  type PlanillaResumen,
  type RegistrarObraEntrada,
  type Rol,
  type Usuario,
} from './obras.graphql';
import {
  claveConsulta,
  completa,
  RespaldoService,
  type ConRespaldo,
} from '../nucleo/respaldo.service';

/** Fotos por página (el valor por defecto de `fotos` en el contrato; Obras acepta hasta 100). */
export const TAMANO_PAGINA_FOTOS = 50;

/** Datos del área de obras: los componentes no usan Apollo directo (docs/estructura.md). */
@Injectable()
export class ObrasService {
  private readonly apollo = inject(Apollo);
  private readonly respaldo = inject(RespaldoService);

  /**
   * Obras que el usuario puede ver; el gateway filtra por estado y busca por nombre (006, criterio 2). Sin conexión,
   * la última respuesta guardada de esos filtros (104); null si nunca se consultó en este equipo.
   */
  listar(filtros: FiltrosObras = {}): Observable<ConRespaldo<ObraResumen[]> | null> {
    return this.respaldo.consultaConRespaldo(claveConsulta(CONSULTA_OBRAS, { ...filtros }), () =>
      completa(
        this.apollo
          .query({ query: CONSULTA_OBRAS, variables: filtros, fetchPolicy: 'network-only' })
          .pipe(map((resultado) => resultado.data?.obras ?? [])),
      ),
    );
  }

  /** Usuarios de Keycloak con un rol (para las asignaciones de la obra). */
  usuarios(rol: Rol): Observable<Usuario[]> {
    return this.apollo
      .query({ query: CONSULTA_USUARIOS, variables: { rol }, fetchPolicy: 'network-only' })
      .pipe(map((resultado) => resultado.data?.usuarios ?? []));
  }

  /**
   * Encabezado, indicadores y partidas de la obra. Admite respuesta parcial (errorPolicy «all»): si un campo
   * secundario falla (por ejemplo los nombres de las asignaciones), la obra se muestra igual. Solo es error si no
   * llega la obra (OBRA_NO_ENCONTRADA, gateway caído); null si no existe sin error.
   */
  obtener(id: string): Observable<ConRespaldo<Obra | null> | null> {
    return this.respaldo.consultaConRespaldo(claveConsulta(CONSULTA_OBRA, { id }), () =>
      this.apollo
        .query({
          query: CONSULTA_OBRA,
          variables: { id },
          fetchPolicy: 'network-only',
          errorPolicy: 'all',
        })
        .pipe(
          map((resultado) => {
            const obra = resultado.data?.obra ?? null;
            if (!obra && resultado.error) throw resultado.error;
            // Con algún campo caído (respuesta parcial) se muestra, pero no se guarda (104)
            return { datos: obra, completa: !resultado.error };
          }),
        ),
    );
  }

  /** Saldo disponible y total cobrado (Finanzas); null sin error si el rol no es admin ni gerente. */
  finanzas(id: string): Observable<ConRespaldo<FinanzasObra | null> | null> {
    return this.respaldo.consultaConRespaldo(claveConsulta(CONSULTA_FINANZAS_OBRA, { id }), () =>
      completa(
        this.apollo
          .query({ query: CONSULTA_FINANZAS_OBRA, variables: { id }, fetchPolicy: 'network-only' })
          .pipe(map((resultado) => resultado.data?.obra?.finanzas ?? null)),
      ),
    );
  }

  /** Material usado frente al previsto del periodo `AAAA-MM`; null si el gateway no lo devuelve. */
  materialComparado(
    id: string,
    periodo: string,
  ): Observable<ConRespaldo<ComparacionMaterial | null> | null> {
    return this.respaldo.consultaConRespaldo(
      claveConsulta(CONSULTA_MATERIAL_COMPARADO, { id, periodo }),
      () =>
        completa(
          this.apollo
            .query({
              query: CONSULTA_MATERIAL_COMPARADO,
              variables: { id, periodo },
              fetchPolicy: 'network-only',
            })
            .pipe(map((resultado) => resultado.data?.obra?.materialComparado ?? null)),
        ),
    );
  }

  /** Una página de fotos de avance, de la más reciente a la más antigua (orden de Obras). */
  fotos(
    id: string,
    pagina: number,
    tamano = TAMANO_PAGINA_FOTOS,
  ): Observable<ConRespaldo<FotosPagina> | null> {
    return this.respaldo.consultaConRespaldo(
      claveConsulta(CONSULTA_FOTOS, { id, pagina, tamano }),
      () =>
        completa(
          this.apollo
            .query({
              query: CONSULTA_FOTOS,
              variables: { id, pagina, tamano },
              fetchPolicy: 'network-only',
            })
            .pipe(
              map(
                (resultado) =>
                  resultado.data?.obra?.fotos ?? { items: [], total: 0, pagina, tamano },
              ),
            ),
        ),
    );
  }

  planillas(id: string): Observable<ConRespaldo<PlanillaResumen[]> | null> {
    return this.respaldo.consultaConRespaldo(claveConsulta(CONSULTA_PLANILLAS, { id }), () =>
      completa(
        this.apollo
          .query({ query: CONSULTA_PLANILLAS, variables: { id }, fetchPolicy: 'network-only' })
          .pipe(map((resultado) => resultado.data?.obra?.planillas ?? [])),
      ),
    );
  }

  /** Cobros de la obra (Finanzas); null sin error si el rol no es admin ni gerente. */
  cobros(id: string): Observable<ConRespaldo<Cobro[] | null> | null> {
    return this.respaldo.consultaConRespaldo(claveConsulta(CONSULTA_COBROS, { id }), () =>
      completa(
        this.apollo
          .query({ query: CONSULTA_COBROS, variables: { id }, fetchPolicy: 'network-only' })
          .pipe(map((resultado) => resultado.data?.obra?.cobros ?? null)),
      ),
    );
  }

  /**
   * Consumos atípicos de la obra (403), de la más reciente a la más antigua; sin `estado`, todos. Si IA no responde,
   * el campo llega en null con error y se entrega el error (la sección muestra «—» con su aviso).
   */
  consumosAtipicos(
    id: string,
    estado: EstadoRevision | null,
  ): Observable<ConRespaldo<ConsumoAtipico[]> | null> {
    const variables = estado ? { id, estado } : { id };
    return this.respaldo.consultaConRespaldo(
      claveConsulta(CONSULTA_CONSUMOS_ATIPICOS, variables),
      () =>
        completa(
          this.apollo
            .query({ query: CONSULTA_CONSUMOS_ATIPICOS, variables, fetchPolicy: 'network-only' })
            .pipe(map((resultado) => resultado.data?.obra?.consumosAtipicos ?? [])),
        ),
    );
  }

  /** Marca un consumo atípico como NORMAL o CONFIRMADO (403); el comentario va solo si se escribió. */
  revisarConsumoAtipico(
    id: string,
    estado: Exclude<EstadoRevision, 'PENDIENTE'>,
    comentario: string | null,
  ): Observable<ConsumoAtipico> {
    return this.apollo
      .mutate({
        mutation: MUTACION_REVISAR_CONSUMO_ATIPICO,
        variables: comentario ? { id, estado, comentario } : { id, estado },
      })
      .pipe(map((resultado) => resultado.data!.revisarConsumoAtipico));
  }

  registrar(entrada: RegistrarObraEntrada): Observable<{ id: string; estado: EstadoObra }> {
    return this.apollo
      .mutate({ mutation: MUTACION_REGISTRAR_OBRA, variables: { entrada } })
      .pipe(map((resultado) => resultado.data!.registrarObra));
  }
}
