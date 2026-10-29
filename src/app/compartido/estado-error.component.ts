import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Estado de error de docs/diseno-visual.md: «No disponible por el momento. Reintentar». */
@Component({
  selector: 'app-estado-error',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="estado" role="alert">
      <mat-icon fontSet="material-symbols-outlined">cloud_off</mat-icon>
      <p>{{ texto() }}</p>
      <button mat-flat-button (click)="reintentar.emit()">Reintentar</button>
    </section>
  `,
  styles: `
    .estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 32px 24px;
      text-align: center;
      color: var(--sv-error);
      background: var(--sv-error-suave);
      border-radius: var(--sv-radio-tarjeta);
    }
    p {
      margin: 0;
      color: var(--sv-texto);
    }
  `,
})
export class EstadoErrorComponent {
  readonly texto = input('No disponible por el momento.');
  readonly reintentar = output<void>();
}
