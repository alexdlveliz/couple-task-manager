# Tablero compartido

Aplicación privada en español para dos personas. Utiliza React, Cloudflare Workers y D1 para el tablero, y Firebase Authentication para las cuentas. El tablero puede mostrar una copia local de la última consulta autorizada sin conexión; guardar cambios requiere conexión.

## Desarrollo local

Requisitos: make, `ps`, Node.js 22.12 o superior compatible con las dependencias fijadas, pnpm 12.16.1, Java para el emulador de Firebase, OpenSSL en el PATH y las dependencias de Playwright. Las pruebas generan certificados temporales; no se almacenan claves privadas en el repositorio. Todo el siguiente flujo usa el proyecto de demostración `demo-shared-task-board` y D1 local:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
cp .dev.vars.example .dev.vars.local
pnpm exec playwright install
make serve
```

El comando prepara D1 local y las cuentas de demostración, inicia el emulador y la aplicación, y detiene los servicios que inició al pulsar Ctrl-C. Requiere libres los puertos 9099, 4000, 8787 y 5173. También se puede iniciar manualmente:

```sh
pnpm exec firebase emulators:start --only auth --project demo-shared-task-board
```

En otra terminal:

```sh
pnpm exec wrangler d1 migrations apply shared-task-board --local --env local
pnpm run seed:local
pnpm run dev
```

Abre `http://127.0.0.1:5173`. Las cuentas de prueba y sus contraseñas locales están en [scripts/README.md](scripts/README.md). El seeder rechaza proyectos que no sean el de demostración, utiliza únicamente D1 local y conserva los identificadores y la revisión al reiniciar el emulador. Los cambios de nombre o de estado de un integrante incrementan la revisión del tablero.

## Pruebas

Ejecuta `make test` con los requisitos y archivos de configuración locales descritos arriba. Comprueba tipos, pruebas unitarias y de integración, compilación y pruebas de navegador; prepara el emulador y D1 local para estas últimas y detiene los servicios que inicia. Requiere libres los puertos 9099, 4000 y 8787. Un fallo detiene la secuencia e identifica el paso fallido.

También puedes ejecutar las comprobaciones manualmente con el emulador activo y la base local migrada y preparada:

```sh
pnpm run typecheck
pnpm run test:unit
pnpm run test:integration
pnpm run build
pnpm run preview:worker
```

Ejecuta `pnpm run test:browser` en otra terminal con el Worker compilado en `127.0.0.1:8787`. Cierra el Worker de `pnpm run dev` antes de iniciar la vista previa para evitar conflictos de puerto. Los resultados y verificaciones pendientes se registran en [validation.md](specs/001-shared-task-board/validation.md).

## Producción

La configuración de producción requiere un proyecto Firebase propio, exactamente dos cuentas creadas de forma privada, sus UID y nombres en las dos filas D1, y un identificador de base real en Wrangler. Configura `FIREBASE_PROJECT_ID` y las variables `VITE_FIREBASE_*`; compila con `pnpm run build:production` sin activar `VITE_USE_AUTH_EMULATOR`. La entrada Worker de producción rechaza el modo de emulador. La entrada `src/worker/local.ts` es solo para el entorno de desarrollo local.

Mantén las migraciones y `board_metadata.revision` al actualizar el servicio. Cambios administrativos a nombres o habilitación de integrantes incrementan la revisión mediante una migración; nunca registres contraseñas, tokens ni contenido de tareas. Antes de publicar, verifica con un token firmado real de una cuenta autorizada y otra no autorizada, revisa cuotas de Workers/D1 y comprueba el consumo real. El almacenamiento del navegador puede estar deshabilitado, lleno o ser eliminado por el sistema; en esos casos la copia sin conexión puede no estar disponible. Los fallos de cuota o red se muestran como errores de sincronización.

### Comprobación controlada antes de publicar

1. Revisa que la compilación de producción no active el emulador y que el Worker use el ID exacto del proyecto Firebase previsto. Aplica las migraciones al D1 correcto y verifica que existan exactamente las dos filas de integrantes con sus UID reales y habilitados.
2. En un cliente privado de confianza, inicia sesión con una cuenta autorizada y obtén su token de Firebase de forma temporal. Usa un cliente HTTP que no registre cabeceras para consultar `GET /api/partners` y `GET /api/tasks` con ese token en `Authorization: Bearer …`. Comprueba las respuestas 200, las dos identidades autorizadas, `Cache-Control: no-store` y el ETag del tablero.
3. Repite la consulta sin token y con un token válido de una cuenta no autorizada; deben devolver 401 y 403 respectivamente, sin contenido de tareas. Comprueba que el mismo token autorizado deja de acceder tras deshabilitar su fila y que un `If-None-Match` coincidente tampoco evita la autorización. Restaura la habilitación solo mediante la operación administrativa prevista, que debe incrementar la revisión.
4. Descarta los tokens, elimina cualquier captura temporal y comprueba que los registros no contienen credenciales ni contenido de tareas. Mide CPU y filas en el entorno real antes de aceptar la capacidad de producción.

La limpieza local utiliza IndexedDB y marcadores de respaldo en el almacenamiento local o una cookie. Si todos estos mecanismos fallan al mismo tiempo durante el cierre de sesión, no se puede conservar una señal de limpieza pendiente después de cerrar todas las pestañas; se ha elegido mantener la reapertura sin conexión y aceptar ese caso excepcional. Revisa [validation.md](specs/001-shared-task-board/validation.md) antes de considerar completa la garantía de privacidad sin conexión.
