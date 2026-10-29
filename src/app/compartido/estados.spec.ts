import { TestBed } from '@angular/core/testing';
import { EstadoErrorComponent } from './estado-error.component';
import { EstadoVacioComponent } from './estado-vacio.component';

describe('estados vacío y error', () => {
  it('el estado vacío muestra el texto y la acción', () => {
    const fixture = TestBed.createComponent(EstadoVacioComponent);
    fixture.componentRef.setInput('texto', 'Aún no hay obras.');
    fixture.componentRef.setInput('accion', 'Registrar obra');
    let pulsado = false;
    fixture.componentInstance.pulsado.subscribe(() => (pulsado = true));
    fixture.detectChanges();

    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.textContent).toContain('Aún no hay obras.');
    elemento.querySelector('button')!.click();
    expect(pulsado).toBe(true);
  });

  it('el estado vacío sin acción no muestra botón', () => {
    const fixture = TestBed.createComponent(EstadoVacioComponent);
    fixture.componentRef.setInput('texto', 'Aún no hay obras.');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });

  it('el estado de error ofrece Reintentar', () => {
    const fixture = TestBed.createComponent(EstadoErrorComponent);
    let reintentos = 0;
    fixture.componentInstance.reintentar.subscribe(() => reintentos++);
    fixture.detectChanges();

    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.textContent).toContain('No disponible por el momento.');
    elemento.querySelector('button')!.click();
    expect(reintentos).toBe(1);
  });
});
