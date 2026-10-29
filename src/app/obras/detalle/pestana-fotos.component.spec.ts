import { TestBed } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import type { Foto, FotosPagina } from '../obras.graphql';
import { ObrasService } from '../obras.service';
import { PestanaFotosComponent, agruparFotos } from './pestana-fotos.component';

const PARTIDAS = [
  { id: 'p1', codigo: 'P-01', nombre: 'Excavación' },
  { id: 'p2', codigo: 'P-02', nombre: 'Losa' },
];

const foto = (id: string, partidaId: string, registradoEn: string, autor: string | null = 'Mario Quispe'): Foto => ({
  id,
  partidaId,
  registradoPor: autor ? { id: 'u-' + autor, nombre: autor } : null,
  registradoEn,
  urlDescarga: `https://s3.example/${id}.jpg`,
});

const FOTOS = [
  foto('f1', 'p2', '2026-11-10T14:00:00Z'),
  foto('f2', 'p1', '2026-11-12T15:20:00Z', 'Rosa Vaca'),
  foto('f3', 'p2', '2026-11-15T18:30:00Z', null),
];

function montar(fotos: (id: string, pagina: number) => Observable<FotosPagina>) {
  TestBed.configureTestingModule({
    imports: [PestanaFotosComponent],
    providers: [{ provide: ObrasService, useValue: { fotos } }],
  });
  const fixture = TestBed.createComponent(PestanaFotosComponent);
  fixture.componentRef.setInput('obraId', 'b1');
  fixture.componentRef.setInput('partidas', PARTIDAS);
  fixture.detectChanges();
  return { fixture, elemento: fixture.nativeElement as HTMLElement };
}

const pagina = (items: Foto[], total = items.length, numero = 1): FotosPagina => ({
  items,
  total,
  pagina: numero,
  tamano: 50,
});

describe('PestanaFotosComponent', () => {
  it('agrupa por partida en el orden de la obra y de la más reciente a la más antigua (005, criterio 6)', () => {
    const grupos = agruparFotos(FOTOS, PARTIDAS);
    expect(grupos.map((grupo) => [grupo.titulo, grupo.fotos.map((f) => f.id)])).toEqual([
      ['P-01 · Excavación', ['f2']],
      ['P-02 · Losa', ['f3', 'f1']],
    ]);
  });

  it('una foto de una partida que no está en la lista va al final', () => {
    const grupos = agruparFotos([foto('f9', 'px', '2026-11-01T12:00:00Z'), ...FOTOS], PARTIDAS);
    expect(grupos.map((grupo) => grupo.titulo)).toEqual(['P-01 · Excavación', 'P-02 · Losa', 'Otra partida']);
  });

  it('muestra la galería con fecha y hora de La Paz y autor', () => {
    const fotos = vi.fn(() => of(pagina(FOTOS)));
    const { elemento } = montar(fotos);
    expect(fotos).toHaveBeenCalledExactlyOnceWith('b1', 1);
    const titulos = [...elemento.querySelectorAll('h3')].map((h3) => h3.textContent?.replace(/\s+/g, ' ').trim());
    expect(titulos).toEqual(['P-01 · Excavación · 1', 'P-02 · Losa · 2']);
    const leyendas = [...elemento.querySelectorAll('figcaption')].map((leyenda) =>
      [...leyenda.querySelectorAll('span')].map((parte) => parte.textContent?.trim()),
    );
    expect(leyendas).toEqual([
      ['12/11/2026 11:20', 'Rosa Vaca'],
      ['15/11/2026 14:30', '—'],
      ['10/11/2026 10:00', 'Mario Quispe'],
    ]);
    const imagen = elemento.querySelector('img')!;
    expect(imagen.getAttribute('src')).toBe('https://s3.example/f2.jpg');
    expect(imagen.getAttribute('alt')).toBe('Foto de P-01 · Excavación del 12/11/2026 11:20');
  });

  it('sin fotos muestra el estado vacío', () => {
    expect(montar(() => of(pagina([]))).elemento.textContent).toContain('Aún no hay fotos de avance.');
  });

  it('«Cargar más fotos» trae la página siguiente y la suma a la galería', () => {
    const fotos = vi.fn((_id: string, numero: number) =>
      of(numero === 1 ? pagina(FOTOS.slice(0, 2), 3) : pagina([FOTOS[2]], 3, 2)),
    );
    const { fixture, elemento } = montar(fotos);
    const boton = () => [...elemento.querySelectorAll('button')].find((b) => b.textContent?.includes('Cargar más'));
    expect(elemento.querySelectorAll('img')).toHaveLength(2);
    boton()!.click();
    fixture.detectChanges();
    expect(fotos).toHaveBeenLastCalledWith('b1', 2);
    expect(elemento.querySelectorAll('img')).toHaveLength(3);
    expect(boton()).toBeUndefined();
  });

  it('si no responde muestra «No disponible por el momento» y reintenta (criterio 4)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const respuestas: Observable<FotosPagina>[] = [throwError(() => new Error('caído')), of(pagina(FOTOS))];
    const { fixture, elemento } = montar(() => respuestas.shift()!);
    expect(elemento.textContent).toContain('No disponible por el momento.');
    elemento.querySelector('app-estado-error button')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(elemento.querySelectorAll('img')).toHaveLength(3);
  });
});
