import { TestBed } from '@angular/core/testing';
import { AvisoSinConexionComponent } from './aviso-sin-conexion.component';

describe('AvisoSinConexionComponent', () => {
  function pintar(guardadoEn: string | null): string {
    const fixture = TestBed.createComponent(AvisoSinConexionComponent);
    fixture.componentRef.setInput('guardadoEn', guardadoEn);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('muestra la fecha y hora de La Paz de los datos guardados', () => {
    expect(pintar('2026-11-15T18:30:00Z')).toContain('Sin conexión · datos del 15/11/2026 14:30');
  });

  it('sin datos guardados lo dice', () => {
    expect(pintar(null)).toContain('No hay datos guardados de esta pantalla');
  });
});
