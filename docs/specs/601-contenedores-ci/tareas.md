# 601 · Contenedores y CI/CD · tareas de `frontend/mf-obras`

Requisitos y diseño: `docs/specs/601-contenedores-ci/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] `environment.prod.ts` con la URL del gateway de producción
- [ ] `staticwebapp.config.json`: `navigationFallback` y encabezado `Access-Control-Allow-Origin` del shell para `remoteEntry.json` y los `.js`
- [ ] `Dockerfile` (`node:24-alpine` para compilar, `nginxinc/nginx-unprivileged:1.29-alpine` para servir) con `nginx.conf` propio y `.dockerignore`
- [ ] `.github/workflows/ci-cd.yml`: pruebas y build; imagen nginx en GHCR; despliegue de los archivos estáticos con `Azure/static-web-apps-deploy@v1`
- [ ] Comprobar: la imagen sirve la aplicación en el puerto 8080 sin `root`
