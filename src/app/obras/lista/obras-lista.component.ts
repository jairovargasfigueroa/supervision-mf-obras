import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { EstadoChipComponent } from '../../compartido/estado-chip.component';
import { EstadoErrorComponent } from '../../compartido/estado-error.component';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { formatearFecha, formatearPorcentaje } from '../../nucleo/formato';
import { SesionService } from '../../nucleo/sesion.service';
import type { ObraResumen } from '../obras.graphql';
import { ObrasService } from '../obras.service';

/**
 * Lista de obras. En la fase 1 (1.10) es el esqueleto que camina: consulta `obras` al gateway y, como Obras todavía
 * no guarda obras, muestra el estado vacío. La 006 agrega filtros, avance, plazo y riesgo.
 */
@Component({
  selector: 'app-obras-lista',
  imports: [RouterLink, MatButtonModule, MatIconModule, EstadoChipComponent, EstadoVacioComponent, EstadoErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pagina">
      <header class="titulo">
        <h1>Obras</h1>
        @if (sesion.dentroDelErp() && esAdmin()) {
          <a mat-flat-button routerLink="nueva">
            <mat-icon fontSet="material-symbols-outlined">add</mat-icon>
            Nueva obra
          </a>
        }
      </header>
      @if (!sesion.dentroDelErp()) {
        <app-estado-vacio texto="Abre esta pantalla desde el ERP." icono="open_in_new" />
      } @else if (estado() === 'cargando') {
        <p class="cargando">Cargando obras…</p>
      } @else if (estado() === 'error') {
        <app-estado-error (reintentar)="cargar()" />
      } @else if (obras().length === 0) {
        <app-estado-vacio
          texto="Aún no hay obras."
          icono="apartment"
          [accion]="esAdmin() ? 'Registrar obra' : undefined"
          (pulsado)="registrar()"
        />
      } @else {
        <ul class="obras">
          @for (obra of obras(); track obra.id) {
            <li>
              <a class="obra" [routerLink]="obra.id">
                <span class="datos">
                  <strong>{{ obra.nombre }}</strong>
                  <span>{{ obra.ubicacion }}</span>
                  <span>Inicio {{ fecha(obra.fechaInicio) }} · Avance {{ porcentaje(obra.avancePct) }}</span>
                </span>
                <app-estado-chip [estado]="obra.estado" />
              </a>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .pagina {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .titulo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .cargando {
      color: var(--sv-texto-secundario);
    }
    .obras {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .obra {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: inherit;
      text-decoration: none;
      padding: 12px 16px;
      background: var(--sv-superficie);
      border: 1px solid var(--sv-borde);
      border-radius: var(--sv-radio-tarjeta);
    }
    .obra:hover {
      border-color: var(--sv-primario);
    }
    .datos {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    @media (max-width: 599px) {
      .pagina {
        padding: 16px;
      }
    }
  `,
})
export class ObrasListaComponent implements OnInit {
  protected readonly sesion = inject(SesionService);
  private readonly servicio = inject(ObrasService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  /** Solo admin registra obras (002, criterio 10): residente y gerente no ven «Nueva obra». */
  protected readonly esAdmin = computed(() => this.sesion.usuario()?.roles.includes('admin') ?? false);

  protected readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  protected readonly obras = signal<ObraResumen[]>([]);
  protected readonly fecha = formatearFecha;
  protected readonly porcentaje = formatearPorcentaje;

  ngOnInit(): void {
    if (this.sesion.dentroDelErp()) this.cargar();
  }

  registrar(): void {
    void this.router.navigate(['nueva'], { relativeTo: this.ruta });
  }

  cargar(): void {
    this.estado.set('cargando');
    this.servicio.listar().subscribe({
      next: (obras) => {
        this.obras.set(obras);
        this.estado.set('listo');
      },
      error: () => this.estado.set('error'),
    });
  }
}
