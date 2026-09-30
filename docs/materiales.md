# Materiales para pedidos de Paco

Sección independiente del inventario mensual de telas. Registra material disponible en el almacén: cajas, cajas colectivas, bolsas, cartones, fotolitos y otros.

- Cada variante tiene nombre, familia, unidades por paquete habitual, mínimo y notas de proveedor/referencia.
- Las existencias son la suma de movimientos firmados, identificados individualmente. Registrar 2.380 unidades y retirar un paquete de 500 deja 1.880.
- La equivalencia en paquetes es matemática: no garantiza que los paquetes físicos estén completos.
- Entradas y retiradas admiten unidades sueltas o paquetes. No se descuentan automáticamente al crear pedidos ni entregas.
- El recuento se corrige mediante otro movimiento con motivo obligatorio, conservando el historial. No se permite retirar más de lo disponible localmente.
- Cambios simultáneos de distintos dispositivos conservan ambos movimientos. Si causan existencias negativas, se muestra una advertencia para revisar el recuento; nunca se oculta la diferencia.

## Guardado y copias

`materiales_v1` en localStorage; `materiales` en el documento de usuario de Firestore y en el JSON completo. La validación de copias comprueba cantidades enteras, identificadores y fechas. Las copias v3 anteriores sin este apartado siguen siendo válidas y no sustituyen los materiales existentes.

## Avisos

Indicador persistente en inicio y contador en Materiales cuando existencias <= mínimo. Firebase envía Web Push al entrar en ese estado y, una vez más, al agotarse. No hay recordatorios diarios ni deducción de consumo estimado. Reponer por encima del mínimo permite un nuevo aviso al volver a bajar.

En cada móvil: abrir la app publicada, iniciar sesión, pulsar **Activar avisos en el móvil** y conceder permiso. El registro envía una notificación de prueba (máximo una por minuto); si ya hay mínimos bajos, envía su resumen. En iPhone debe abrirse como aplicación añadida a inicio. Las notificaciones dependen del permiso y del servicio del navegador. Los movimientos offline avisan cuando llegan a Firestore.

La clave privada se almacena exclusivamente en Secret Manager (`MATERIALES_PUSH_20260930`). La función callable `avisosMateriales` requiere autenticación; devuelve únicamente la clave pública y registra/desactiva el dispositivo actual. `materialDevices` y `materialPushEvents` son colecciones de servidor sin acceso directo desde el cliente. Los destinos de push se limitan a los proveedores admitidos. Las suscripciones caducadas se eliminan. La función `alertarMateriales` usa el documento más reciente y guarda los envíos realizados para evitar repetir eventos ya procesados; el sistema puede entregar más de una vez ante un fallo entre envío y confirmación, con la misma etiqueta de notificación.

## Comprobación

`node tests/materiales.cjs` prueba cálculo, umbrales, recuentos, copias y concurrencia con datos ficticios. `node tests/materiales-push.cjs` prueba decisiones de aviso, validación de destinos y manejo de push en el service worker. La recepción final en el teléfono requiere activarlo en ese dispositivo.
