import {
  withNativeFederation,
  fromPackageJson,
} from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'mf-obras',

  // El shell carga estas rutas en /obras (erp-shell/src/app/remotos)
  exposes: {
    './Routes': './src/app/app.routes.ts',
  },

  //shareScope: autoShareScope({level: 'minor'}),

  shared: fromPackageJson({
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
    build: 'package',
  })
    .patch(['@angular/*'], { includeSecondaries: { keepAll: true } })
    .get(),

  //sharedMappings: mappingsFromWorkspace({ singleton: true }).filter(['@my-org/*']).get(),

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Requieren @angular/animations, que no usamos
    '@angular/platform-browser/animations',
    '@angular/platform-browser/animations/async',
    // Código de Node para `ng add`/`ng generate`, no para el navegador
    /^@angular\/(cdk|material)\/schematics/,
  ],

  // Please read our docs about configuring native federation:
  // https://native-federation.com/docs/v4/angular-adapter/configuration/

  features: {
    denseChunking: true,
    denseExternals: true,
    strictImports: false,
  },
});
