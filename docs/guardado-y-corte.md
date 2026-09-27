# Guardado y flujo de trabajo

- Sincronizacion mediante transaccion de Firestore y comparacion entre ultima copia confirmada, datos locales y nube. Las ediciones y eliminaciones se combinan por campo y por identificador.
- Si cambia el mismo campo en ambos dispositivos, prevalece el cambio local pendiente; se guarda una copia recuperable con ambas versiones. En la primera sincronizacion sin referencia previa prevalece la nube en los campos incompatibles. No se suman automaticamente cantidades porque pueden ser correcciones del mismo corte.
- La ultima referencia se conserva entre aperturas. Sin conexion, los cambios quedan locales y se reintentan al volver la conexion o el foco. No mezclar cuentas: se bloquea la subida si cambia el propietario local.
- Actualizar todos los dispositivos antes de combinar su uso: versiones antiguas siguen usando el guardado anterior.
- JSON version 3 incluye clientes, todos los fichajes, jornada, notas, calculadora, entregas, preparacion, corte, inventarios, categorias y fuente. No incluye credenciales. Las copias antiguas solo reemplazan sus apartados. La restauracion conserva una copia previa recuperable.
- Envios parciales se distinguen por talla y categoria. Las entregas antiguas sin categoria solo se atribuyen automaticamente si hay una unica coincidencia. Las ambiguas requieren correccion antes de otro envio.
- Detalle de Corte con diseno Hoja de trabajo: tela y categoria arriba, columnas Talla / Cortadas / Faltan, progreso discreto y accion principal para anadir unidades.
- Modo trabajo pliega lineas completadas; las tarjetas muestran lineas pendientes y unidades restantes. Entregas se ordena y agrupa por fecha de entrega descendente, con las entregas sin fecha al final. Deshacer dura 10 segundos y comprueba que nadie haya cambiado el registro.

## Comprobacion

Ejecutar: node tests/workflow.cjs

Pruebas con almacenamiento, DOM y Firestore simulados, sin acceso a datos reales. Cubren sincronizacion, conflictos, desconexion, restauracion, categorias, cantidades parciales y deshacer. No sustituyen una prueba visual en movil ni una integracion con Firebase desplegado.

## Acabado visual

Inicio con fecha e iconos uniformes. Tarjetas de pedidos con unidades pendientes y estado. Entregas con fechas legibles y tarjetas separando tela, confeccion y referencia. Colores compartidos: naranja pendiente, azul en proceso y verde completado. El orden sigue siendo de mas reciente a mas antiguo, sin fecha al final.
