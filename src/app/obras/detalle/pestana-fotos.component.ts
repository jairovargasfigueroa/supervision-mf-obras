import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import type { Subscription } from 'rxjs';
import { AvisoSinConexionComponent } from '../../compartido/aviso-sin-conexion.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { leerError, registrarError } from '../../nucleo/errores';
import { formatearFechaHora } from '../../nucleo/formato';
import type { Foto, Partida } from '../obras.graphql';
import { ObrasService } from '../obras.service';

export interface GrupoFotos {
  partidaId: string;
  /** `P-01 · Losa` */
  titulo: string;
  fotos: Foto[];
}

/**
 * Fotos agrupadas por partida (en el orden de las partidas de la obra) y, dentro de cada una, de la más reciente a la
 * más antigua (005, criterio 6). Las partidas sin fotos no aparecen.
 */
export function agruparFotos(
  fotos: Foto[],
  partidas: Pick<Partida, 'id' | 'codigo' | 'nombre'>[],
): GrupoFotos[] {
  const porPartida = new Map<string, Foto[]>();
  for (const foto of fotos)
    porPartida.set(foto.partidaId, [...(porPartida.get(foto.partidaId) ?? []), foto]);
  const conocidas = partidas.map((partida) => ({
    partidaId: partida.id,
    titulo: `${partida.codigo} · ${partida.nombre}`,
  }));
  const otras = [...porPartida.keys()]
    .filter((id) => !partidas.some((partida) => partida.id === id))
    .map((partidaId) => ({ partidaId, titulo: 'Otra partida' }));
  return [...conocidas, ...otras]
    .filter((grupo) => porPartida.has(grupo.partidaId))
    .map((grupo) => ({
      ...grupo,
      fotos: [...porPartida.get(grupo.partidaId)!].sort(
        (a, b) => Date.parse(b.registradoEn) - Date.parse(a.registradoEn),
      ),
    }));
}

/**
 * Pestaña «Fotos» (006 y 005, criterio 6): galería por partida con fecha y autor. Pide la primera página al abrirse;
 * «Cargar más fotos» trae las siguientes. Si no responde, «No disponible por el momento» (criterio 4).
 */
@Component({
  selector: 'app-pestana-fotos',
  imports: [MatButtonModule, EstadoErrorComponent, EstadoVacioComponent, AvisoSinConexionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-fotos.component.html',
  styleUrls: ['./pestana.scss', './pestana-fotos.component.scss'],
})
export class PestanaFotosComponent implements OnInit {
  readonly obraId = input.required<string>();
  readonly partidas = input.required<Pick<Partida, 'id' | 'codigo' | 'nombre'>[]>();

  private readonly servicio = inject(ObrasService);
  private readonly destruir = inject(DestroyRef);

  protected readonly estado = signal<'cargando' | 'listo' | 'error' | 'sin-datos'>('cargando');
  /** Fecha de los datos guardados en el equipo cuando se muestran sin conexión (104). */
  protected readonly guardadoEn = signal<string | null>(null);
  protected readonly fotos = signal<Foto[]>([]);
  protected readonly total = signal(0);
  protected readonly cargandoMas = signal(false);
  protected readonly errorMas = signal(false);
  protected readonly grupos = computed(() => agruparFotos(this.fotos(), this.partidas()));
  protected readonly hayMas = computed(() => this.fotos().length < this.total());
  protected readonly fechaHora = formatearFechaHora;

  private pagina = 1;
  private consulta?: Subscription;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.consulta?.unsubscribe();
    this.estado.set('cargando');
    this.pagina = 1;
    this.consulta = this.servicio
      .fotos(this.obraId(), 1)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (respuesta) => {
          this.guardadoEn.set(respuesta?.guardadoEn ?? null);
          if (!respuesta) {
            this.estado.set('sin-datos');
            return;
          }
          this.fotos.set(respuesta.datos.items);
          this.total.set(respuesta.datos.total);
          this.estado.set('listo');
        },
        error: (error: unknown) => {
          registrarError('fotos', leerError(error));
          this.estado.set('error');
        },
      });
  }

  cargarMas(): void {
    this.consulta?.unsubscribe();
    this.cargandoMas.set(true);
    this.errorMas.set(false);
    this.consulta = this.servicio
      .fotos(this.obraId(), this.pagina + 1)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (respuesta) => {
          if (!respuesta) {
            // Sin conexión y esa página no se guardó
            this.cargandoMas.set(false);
            this.errorMas.set(true);
            return;
          }
          const pagina = respuesta.datos;
          this.pagina = pagina.pagina;
          const vistas = new Set(this.fotos().map((foto) => foto.id));
          this.fotos.update((fotos) => [
            ...fotos,
            ...pagina.items.filter((foto) => !vistas.has(foto.id)),
          ]);
          this.total.set(pagina.total);
          this.cargandoMas.set(false);
        },
        error: (error: unknown) => {
          registrarError('fotos', leerError(error));
          this.cargandoMas.set(false);
          this.errorMas.set(true);
        },
      });
  }
}
