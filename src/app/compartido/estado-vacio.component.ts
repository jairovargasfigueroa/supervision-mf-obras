import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Estado vacío de docs/diseno-visual.md: texto y, si hay, una acción («Aún no hay obras. Registrar obra»). */
@Component({
  selector: 'app-estado-vacio',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="estado">
      <mat-icon fontSet="material-symbols-outlined">{{ icono() }}</mat-icon>
      <p>{{ texto() }}</p>
      @if (accion()) {
        <button mat-flat-button (click)="pulsado.emit()">{{ accion() }}</button>
      }
    </section>
  `,
  styles: `
    .estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 24px;
      text-align: center;
      color: var(--sv-texto-secundario);
      background: var(--sv-superficie);
      border: 1px solid var(--sv-borde);
      border-radius: var(--sv-radio-tarjeta);
    }
    p {
      margin: 0;
    }
  `,
})
export class EstadoVacioComponent {
  readonly texto = input.required<string>();
  readonly accion = input<string>();
  readonly icono = input('inbox');
  readonly pulsado = output<void>();
}
