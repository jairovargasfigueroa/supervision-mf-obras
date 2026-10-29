import { ChangeDetectorRef, effect, inject } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  Validators,
  type AbstractControl,
  type NonNullableFormBuilder,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import type { RegistrarObraEntrada } from '../obras.graphql';
import { resumirPresupuesto } from './presupuesto';

// Formulario reactivo tipado de «Nueva obra» (002, criterios 2 a 6) y su conversión a RegistrarObraEntrada.

export type FormDatos = FormGroup<{
  nombre: FormControl<string>;
  ubicacion: FormControl<string>;
  fechaInicio: FormControl<string>;
  residenteId: FormControl<string>;
  maestroId: FormControl<string>;
  almaceneroId: FormControl<string>;
  clienteId: FormControl<string>;
}>;

export type FormContrato = FormGroup<{
  monto: FormControl<number | null>;
  plazoDias: FormControl<number | null>;
  anticipoPct: FormControl<number | null>;
  retencionPct: FormControl<number | null>;
  firmadoEn: FormControl<string>;
}>;

export type FormPartida = FormGroup<{
  codigo: FormControl<string>;
  nombre: FormControl<string>;
  unidad: FormControl<string>;
  cantidadContratada: FormControl<number | null>;
  precioUnitario: FormControl<number | null>;
  meses: FormControl<string>;
}>;

export type FormPartidas = FormArray<FormPartida>;

export type FormObra = FormGroup<{
  datos: FormDatos;
  contrato: FormContrato;
  partidas: FormPartidas;
}>;

/** Número mayor a 0 (monto, plazo, cantidad, precio). Vacío lo marca `required`. */
export const mayorQueCero: ValidatorFn = (control) =>
  typeof control.value === 'number' && !(control.value > 0) ? { mayorQueCero: true } : null;

/** Número entero (plazo en días). */
export const entero: ValidatorFn = (control) =>
  typeof control.value === 'number' && !Number.isInteger(control.value) ? { entero: true } : null;

/** Anticipo + retención < 100 (criterio 3). Error en el grupo del contrato. */
export const porcentajesSumanMenosDe100: ValidatorFn = (grupo) => {
  const anticipo = grupo.get('anticipoPct')?.value;
  const retencion = grupo.get('retencionPct')?.value;
  if (typeof anticipo !== 'number' || typeof retencion !== 'number') return null;
  return anticipo + retencion >= 100 ? { porcentajes: true } : null;
};

/** Al menos una partida y códigos únicos en la obra (criterio 4). Compara sin espacios ni mayúsculas. */
export const partidasValidas: ValidatorFn = (arreglo) => {
  const partidas = (arreglo as FormPartidas).controls;
  if (partidas.length === 0) return { sinPartidas: true };
  const repetidos = codigosRepetidos(partidas.map((partida) => partida.controls.codigo.value));
  return repetidos.length ? { codigoRepetido: repetidos } : null;
};

/** Suma de partidas = monto del contrato con tolerancia 0,01 (criterio 6). Error en el formulario completo. */
export const presupuestoCoincideConMonto: ValidatorFn = (formulario) => {
  const { partidas, contrato } = (formulario as FormObra).getRawValue();
  if (partidas.length === 0 || typeof contrato.monto !== 'number') return null;
  return resumirPresupuesto(partidas, contrato.monto).coincide ? null : { presupuesto: true };
};

export function codigosRepetidos(codigos: readonly string[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const codigo of codigos.map((valor) => valor.trim().toUpperCase()).filter(Boolean)) {
    if (vistos.has(codigo)) repetidos.add(codigo);
    vistos.add(codigo);
  }
  return [...repetidos];
}

export function crearPartida(fb: NonNullableFormBuilder): FormPartida {
  return fb.group({
    codigo: fb.control('', Validators.required),
    nombre: fb.control('', Validators.required),
    unidad: fb.control('', Validators.required),
    cantidadContratada: new FormControl<number | null>(null, [Validators.required, mayorQueCero]),
    precioUnitario: new FormControl<number | null>(null, [Validators.required, mayorQueCero]),
    meses: fb.control(''),
  });
}

export function crearFormulario(fb: NonNullableFormBuilder): FormObra {
  return fb.group(
    {
      datos: fb.group({
        nombre: fb.control('', [Validators.required, Validators.maxLength(150)]),
        ubicacion: fb.control('', [Validators.required, Validators.maxLength(200)]),
        fechaInicio: fb.control('', Validators.required),
        residenteId: fb.control('', Validators.required),
        maestroId: fb.control('', Validators.required),
        almaceneroId: fb.control('', Validators.required),
        clienteId: fb.control('', Validators.required),
      }),
      contrato: fb.group(
        {
          monto: new FormControl<number | null>(null, [Validators.required, mayorQueCero]),
          plazoDias: new FormControl<number | null>(null, [Validators.required, mayorQueCero, entero]),
          anticipoPct: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
          retencionPct: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
          firmadoEn: fb.control('', Validators.required),
        },
        { validators: porcentajesSumanMenosDe100 },
      ),
      partidas: fb.array([crearPartida(fb)], { validators: partidasValidas }),
    },
    { validators: presupuestoCoincideConMonto },
  );
}

/** Valor del formulario (ya válido) → entrada de la mutación. Los textos van sin espacios de más; sin insumos (003). */
export function aEntrada(formulario: FormObra): RegistrarObraEntrada {
  const { datos, contrato, partidas } = formulario.getRawValue();
  return {
    nombre: datos.nombre.trim(),
    ubicacion: datos.ubicacion.trim(),
    fechaInicio: datos.fechaInicio,
    asignaciones: {
      residenteId: datos.residenteId,
      maestroId: datos.maestroId,
      almaceneroId: datos.almaceneroId,
      clienteId: datos.clienteId,
    },
    contrato: {
      monto: contrato.monto!,
      plazoDias: contrato.plazoDias!,
      anticipoPct: contrato.anticipoPct!,
      retencionPct: contrato.retencionPct!,
      firmadoEn: contrato.firmadoEn,
    },
    partidas: partidas.map((partida) => ({
      codigo: partida.codigo.trim(),
      nombre: partida.nombre.trim(),
      unidad: partida.unidad.trim(),
      cantidadContratada: partida.cantidadContratada!,
      precioUnitario: partida.precioUnitario!,
      ...(partida.meses.trim() ? { meses: partida.meses.trim() } : {}),
    })),
  };
}

/** Primer mensaje de validación de un campo (texto corto bajo el campo). */
export function mensajeCampo(control: AbstractControl | null): string {
  const errores: ValidationErrors | null = control?.errors ?? null;
  if (!errores) return '';
  if (errores['required']) return 'Obligatorio';
  if (errores['maxlength']) return `Máximo ${errores['maxlength'].requiredLength} caracteres`;
  if (errores['mayorQueCero']) return 'Debe ser mayor a 0';
  if (errores['entero']) return 'Debe ser un número entero de días';
  if (errores['min'] || errores['max']) return 'Debe estar entre 0 y 100';
  return 'Valor no válido';
}

/**
 * Con OnPush y sin zone.js, un cambio de estado hecho desde otro componente (markAllAsTouched al pulsar «Siguiente»)
 * no vuelve a pintar este. Se escuchan los eventos del control y se marca la vista para revisar.
 * Llamar en el contexto de inyección del componente.
 */
export function revisarAlCambiarEstado(control: () => AbstractControl): void {
  const detector = inject(ChangeDetectorRef);
  effect((alLimpiar) => {
    const suscripcion = control().events.subscribe(() => detector.markForCheck());
    alLimpiar(() => suscripcion.unsubscribe());
  });
}
