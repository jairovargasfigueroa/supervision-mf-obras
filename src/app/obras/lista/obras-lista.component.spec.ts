import { TestBed } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import type { ObraResumen } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import { ObrasListaComponent } from './obras-lista.component';

function montar(respuesta: () => Observable<ObraResumen[]>): HTMLElement {
  TestBed.configureTestingModule({
    imports: [ObrasListaComponent],
    providers: [{ provide: ObrasService, useValue: { listar: respuesta } }],
  });
  const fixture = TestBed.createComponent(ObrasListaComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ObrasListaComponent', () => {
  afterEach(() => delete window.plataforma);

  it('fuera del ERP pide abrir la pantalla desde el ERP y no consulta', () => {
    let consultas = 0;
    const elemento = montar(() => {
      consultas++;
      return of([]);
    });
    expect(elemento.textContent).toContain('Abre esta pantalla desde el ERP.');
    expect(consultas).toBe(0);
  });

  describe('dentro del ERP', () => {
    beforeEach(() => {
      window.plataforma = { configuracion: { gatewayUrl: 'http://localhost:4000/graphql' } };
    });

    it('muestra el estado vacío cuando el gateway devuelve la lista vacía', () => {
      expect(montar(() => of([])).textContent).toContain('Aún no hay obras.');
    });

    it('muestra el estado de error si la consulta falla', () => {
      const elemento = montar(() => throwError(() => new Error('sin conexión')));
      expect(elemento.textContent).toContain('No disponible por el momento.');
    });

    it('lista las obras que llegan', () => {
      const obra: ObraResumen = {
        id: 'b1',
        nombre: 'Edificio Las Palmas',
        ubicacion: 'Santa Cruz',
        estado: 'EN_EJECUCION',
        fechaInicio: '2026-11-01',
        avancePct: 32.5,
        plazoPct: 41,
        enRiesgo: false,
      };
      const elemento = montar(() => of([obra]));
      expect(elemento.textContent).toContain('Edificio Las Palmas');
      expect(elemento.textContent).toContain('Inicio 01/11/2026 · Avance 32,5 %');
    });
  });
});
