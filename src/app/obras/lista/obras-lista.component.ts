import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EstadoVacioComponent } from '../../compartido/estado-vacio.component';
import { SesionService } from '../../nucleo/sesion.service';

/** Lista de obras. En la fase 1 solo muestra el estado vacío; los datos llegan con la 1.10 y la 006. */
@Component({
  selector: 'app-obras-lista',
  imports: [EstadoVacioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pagina">
      <h1>Obras</h1>
      @if (sesion.dentroDelErp()) {
        <app-estado-vacio texto="Aún no hay obras." icono="apartment" />
      } @else {
        <app-estado-vacio texto="Abre esta pantalla desde el ERP." icono="open_in_new" />
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
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    @media (max-width: 599px) {
      .pagina {
        padding: 16px;
      }
    }
  `,
})
export class ObrasListaComponent {
  protected readonly sesion = inject(SesionService);
}
