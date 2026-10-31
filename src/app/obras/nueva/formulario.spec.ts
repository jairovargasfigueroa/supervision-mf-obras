import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { aEntrada, codigosRepetidos, crearFormulario, crearPartida, mensajeCampo, type FormObra } from './formulario';

function formularioCompleto(): FormObra {
  const fb = TestBed.inject(NonNullableFormBuilder);
  const formulario = crearFormulario(fb);
  formulario.controls.datos.setValue({
    nombre: 'Edificio Las Palmas',
    ubicacion: 'Av. Banzer 4to anillo, Santa Cruz',
    zona: '',
    fechaInicio: '2026-11-01',
    residenteId: 'r1',
    maestroId: 'm1',
    almaceneroId: 'a1',
    clienteId: 'c1',
  });
  formulario.controls.contrato.setValue({
    monto: 357425,
    plazoDias: 300,
    anticipoPct: 10,
    retencionPct: 7,
    firmadoEn: '2026-10-20',
  });
  formulario.controls.partidas.at(0).setValue({
    codigo: 'P-01',
    nombre: 'Losa de hormigón armado',
    unidad: 'm2',
    cantidadContratada: 850,
    precioUnitario: 420.5,
    meses: 'nov-dic',
  });
  return formulario;
}

describe('formulario de «Nueva obra» (002, criterios 2 a 6)', () => {
  it('completo y con el presupuesto igual al monto es válido', () => {
    expect(formularioCompleto().valid).toBe(true);
  });

  describe('paso 1: datos y asignaciones', () => {
    it.each(['nombre', 'ubicacion', 'fechaInicio', 'residenteId', 'maestroId', 'almaceneroId', 'clienteId'] as const)(
      '%s es obligatorio',
      (campo) => {
        const formulario = formularioCompleto();
        formulario.controls.datos.controls[campo].setValue('');
        expect(formulario.controls.datos.controls[campo].hasError('required')).toBe(true);
        expect(formulario.valid).toBe(false);
      },
    );

    it('nombre hasta 150 y ubicación hasta 200 caracteres', () => {
      const { nombre, ubicacion } = formularioCompleto().controls.datos.controls;
      nombre.setValue('a'.repeat(150));
      ubicacion.setValue('a'.repeat(200));
      expect(nombre.valid && ubicacion.valid).toBe(true);
      nombre.setValue('a'.repeat(151));
      ubicacion.setValue('a'.repeat(201));
      expect(mensajeCampo(nombre)).toBe('Máximo 150 caracteres');
      expect(mensajeCampo(ubicacion)).toBe('Máximo 200 caracteres');
    });
  });

  describe('paso 2: contrato', () => {
    it.each([0, -5])('monto y plazo deben ser mayores a 0 (%s)', (valor) => {
      const { monto, plazoDias } = formularioCompleto().controls.contrato.controls;
      monto.setValue(valor);
      plazoDias.setValue(valor);
      expect(mensajeCampo(monto)).toBe('Debe ser mayor a 0');
      expect(mensajeCampo(plazoDias)).toBe('Debe ser mayor a 0');
    });

    it('el plazo es un número entero de días', () => {
      const { plazoDias } = formularioCompleto().controls.contrato.controls;
      plazoDias.setValue(10.5);
      expect(plazoDias.hasError('entero')).toBe(true);
    });

    it('anticipo y retención van de 0 a 100', () => {
      const { anticipoPct, retencionPct } = formularioCompleto().controls.contrato.controls;
      anticipoPct.setValue(0);
      retencionPct.setValue(0);
      expect(anticipoPct.valid && retencionPct.valid).toBe(true);
      anticipoPct.setValue(-1);
      retencionPct.setValue(101);
      expect(mensajeCampo(anticipoPct)).toBe('Debe estar entre 0 y 100');
      expect(mensajeCampo(retencionPct)).toBe('Debe estar entre 0 y 100');
    });

    it('anticipo más retención debe sumar menos de 100', () => {
      const contrato = formularioCompleto().controls.contrato;
      contrato.patchValue({ anticipoPct: 60, retencionPct: 39.99 });
      expect(contrato.hasError('porcentajes')).toBe(false);
      contrato.patchValue({ retencionPct: 40 });
      expect(contrato.hasError('porcentajes')).toBe(true);
    });

    it('la fecha de firma es obligatoria', () => {
      const { firmadoEn } = formularioCompleto().controls.contrato.controls;
      firmadoEn.setValue('');
      expect(mensajeCampo(firmadoEn)).toBe('Obligatorio');
    });
  });

  describe('paso 3: partidas', () => {
    it('al menos una partida', () => {
      const formulario = formularioCompleto();
      formulario.controls.partidas.clear();
      expect(formulario.controls.partidas.hasError('sinPartidas')).toBe(true);
    });

    it('el código no se repite en la obra (sin distinguir mayúsculas ni espacios)', () => {
      const formulario = formularioCompleto();
      const otra = crearPartida(TestBed.inject(NonNullableFormBuilder));
      otra.setValue({ codigo: ' p-01 ', nombre: 'Otra', unidad: 'm2', cantidadContratada: 1, precioUnitario: 1, meses: '' });
      formulario.controls.partidas.push(otra);
      expect(formulario.controls.partidas.getError('codigoRepetido')).toEqual(['P-01']);
      expect(codigosRepetidos(['A', 'B', 'a', '', ''])).toEqual(['A']);
    });

    it('cantidad y precio unitario mayores a 0; meses opcional', () => {
      const partida = formularioCompleto().controls.partidas.at(0);
      partida.patchValue({ meses: '' });
      expect(partida.valid).toBe(true);
      partida.patchValue({ cantidadContratada: 0, precioUnitario: -1 });
      expect(partida.controls.cantidadContratada.hasError('mayorQueCero')).toBe(true);
      expect(partida.controls.precioUnitario.hasError('mayorQueCero')).toBe(true);
    });
  });

  describe('presupuesto contra el monto (criterio 6)', () => {
    it('con una diferencia de más de 0,01 no se puede guardar', () => {
      const formulario = formularioCompleto();
      formulario.controls.contrato.controls.monto.setValue(357425.02);
      expect(formulario.hasError('presupuesto')).toBe(true);
      expect(formulario.valid).toBe(false);
    });

    it('con una diferencia de 0,01 se acepta', () => {
      const formulario = formularioCompleto();
      formulario.controls.contrato.controls.monto.setValue(357424.99);
      expect(formulario.hasError('presupuesto')).toBe(false);
    });

    it('se vuelve a validar al cambiar una partida', () => {
      const formulario = formularioCompleto();
      formulario.controls.partidas.at(0).patchValue({ cantidadContratada: 851 });
      expect(formulario.hasError('presupuesto')).toBe(true);
    });
  });

  it('la zona es opcional y empieza en «Sin zona» (401, criterio 1)', () => {
    const fb = TestBed.inject(NonNullableFormBuilder);
    expect(crearFormulario(fb).controls.datos.controls.zona.value).toBe('');
    const formulario = formularioCompleto();
    expect(formulario.controls.datos.controls.zona.valid).toBe(true);
    expect(aEntrada(formulario)).not.toHaveProperty('zona');
  });

  it('aEntrada manda la zona elegida (401, criterio 1)', () => {
    const formulario = formularioCompleto();
    formulario.controls.datos.patchValue({ zona: 'NORTE' });
    expect(aEntrada(formulario).zona).toBe('NORTE');
  });

  it('aEntrada arma RegistrarObraEntrada sin espacios de más y sin meses vacíos', () => {
    const formulario = formularioCompleto();
    formulario.controls.datos.patchValue({ nombre: '  Edificio Las Palmas  ' });
    formulario.controls.partidas.at(0).patchValue({ meses: '  ' });
    expect(aEntrada(formulario)).toEqual({
      nombre: 'Edificio Las Palmas',
      ubicacion: 'Av. Banzer 4to anillo, Santa Cruz',
      fechaInicio: '2026-11-01',
      asignaciones: { residenteId: 'r1', maestroId: 'm1', almaceneroId: 'a1', clienteId: 'c1' },
      contrato: { monto: 357425, plazoDias: 300, anticipoPct: 10, retencionPct: 7, firmadoEn: '2026-10-20' },
      partidas: [
        {
          codigo: 'P-01',
          nombre: 'Losa de hormigón armado',
          unidad: 'm2',
          cantidadContratada: 850,
          precioUnitario: 420.5,
        },
      ],
    });
  });
});
