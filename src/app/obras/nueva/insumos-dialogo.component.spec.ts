import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { FormArray } from '@angular/forms';
import type { FormInsumo, ValorInsumo } from './formulario';
import { InsumosDialogoComponent, type DatosInsumosDialogo } from './insumos-dialogo.component';

const MATERIALES = [
  { id: 'mat-cem', codigo: 'CEM-IP30', nombre: 'Cemento IP-30', unidad: 'bolsa', unidadPlural: 'bolsas' },
  { id: 'mat-are', codigo: 'ARE-FIN', nombre: 'Arena fina', unidad: 'm3', unidadPlural: 'm3' },
];

function montar(insumos: ValorInsumo[] = []) {
  const cerrar = vi.fn();
  const datos: DatosInsumosDialogo = {
    partida: { codigo: 'P-01', nombre: 'Losa de hormigón', unidad: 'm2' },
    materiales: MATERIALES,
    insumos,
  };
  TestBed.configureTestingModule({
    imports: [InsumosDialogoComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: datos },
      { provide: MatDialogRef, useValue: { close: cerrar } },
    ],
  });
  const fixture = TestBed.createComponent(InsumosDialogoComponent);
  fixture.detectChanges();
  const componente = fixture.componentInstance as unknown as InsumosDialogoComponent & {
    insumos: FormArray<FormInsumo>;
  };
  return { fixture, componente, cerrar, elemento: fixture.nativeElement as HTMLElement };
}

describe('InsumosDialogoComponent (002, criterio 4)', () => {
  it('muestra los insumos que ya tiene la partida y la unidad de la partida', () => {
    const { componente, elemento } = montar([{ materialId: 'mat-cem', cantidadPorUnidad: 1.1 }]);
    expect(componente.insumos.length).toBe(1);
    expect(elemento.textContent).toContain('Insumos previstos · P-01');
    expect(elemento.textContent).toContain('Cantidad por m2');
    expect(elemento.textContent).toContain('bolsas');
  });

  it('«Aceptar» devuelve la lista nueva de insumos', () => {
    const { componente, cerrar } = montar();
    componente.agregar();
    componente.insumos.at(0).setValue({ materialId: 'mat-are', cantidadPorUnidad: 0.03 });
    componente.aceptar();
    expect(cerrar).toHaveBeenCalledWith([{ materialId: 'mat-are', cantidadPorUnidad: 0.03 }]);
  });

  it('con un insumo incompleto no se cierra', () => {
    const { componente, cerrar } = montar();
    componente.agregar();
    componente.aceptar();
    expect(cerrar).not.toHaveBeenCalled();
    expect(componente.insumos.at(0).controls.materialId.hasError('required')).toBe(true);
  });

  it('con el mismo material dos veces muestra INSUMO_REPETIDO y no se cierra', () => {
    const { fixture, componente, cerrar, elemento } = montar([
      { materialId: 'mat-cem', cantidadPorUnidad: 1 },
      { materialId: 'mat-cem', cantidadPorUnidad: 2 },
    ]);
    componente.aceptar();
    fixture.detectChanges();
    expect(cerrar).not.toHaveBeenCalled();
    expect(elemento.textContent).toContain('La partida P-01 tiene el mismo material más de una vez.');
  });

  it('quitar deja la partida sin ese insumo', () => {
    const { componente, cerrar } = montar([{ materialId: 'mat-cem', cantidadPorUnidad: 1 }]);
    componente.quitar(0);
    componente.aceptar();
    expect(cerrar).toHaveBeenCalledWith([]);
  });
});
