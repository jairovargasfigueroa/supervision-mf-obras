import { inject, type EnvironmentProviders, type Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ApolloLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { SesionService } from './sesion.service';

/**
 * Apollo hacia el gateway con el token que entrega el shell (window.plataforma.sesion.obtenerToken) en cada
 * consulta. Va en las rutas expuestas: dentro del ERP no se usa app.config.ts de este microfrontend.
 */
export function provideGraphql(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideApollo(() => {
      const sesion = inject(SesionService);
      const conToken = new SetContextLink(async (contexto) => {
        const token = await sesion.obtenerToken();
        return token ? { headers: { ...contexto['headers'], Authorization: `Bearer ${token}` } } : {};
      });
      return {
        link: ApolloLink.from([conToken, inject(HttpLink).create({ uri: sesion.gatewayUrl })]),
        cache: new InMemoryCache(),
      };
    }),
  ];
}
