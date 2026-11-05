import { TestBed } from '@angular/core/testing';
import { GATEWAY_DESARROLLO, SesionService, type Plataforma } from './sesion.service';

describe('SesionService · dirección del gateway (601)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    window.plataforma = undefined;
  });

  it('usa la dirección que publica el shell en window.plataforma.configuracion', () => {
    window.plataforma = {
      configuracion: { gatewayUrl: 'https://gateway.azure.localhost:8443/graphql' },
    };

    expect(TestBed.inject(SesionService).gatewayUrl).toBe(
      'https://gateway.azure.localhost:8443/graphql',
    );
  });

  it('lee la dirección cada vez (si el shell la publica después, la toma)', () => {
    const sesion = TestBed.inject(SesionService);
    expect(sesion.gatewayUrl).toBe(GATEWAY_DESARROLLO);

    window.plataforma = { configuracion: { gatewayUrl: 'https://gateway.ejemplo/graphql' } };

    expect(sesion.gatewayUrl).toBe('https://gateway.ejemplo/graphql');
  });

  it('sin el shell (desarrollo en el 4201) usa la dirección de desarrollo', () => {
    expect(GATEWAY_DESARROLLO).toBe('http://localhost:4000/graphql');
    expect(TestBed.inject(SesionService).gatewayUrl).toBe(GATEWAY_DESARROLLO);
  });

  it('si el shell no publica configuración o la deja vacía, usa la de desarrollo', () => {
    window.plataforma = {} as Plataforma;
    expect(TestBed.inject(SesionService).gatewayUrl).toBe(GATEWAY_DESARROLLO);

    window.plataforma = { configuracion: { gatewayUrl: '' } };
    expect(TestBed.inject(SesionService).gatewayUrl).toBe(GATEWAY_DESARROLLO);
  });
});
