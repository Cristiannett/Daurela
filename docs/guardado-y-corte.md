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

## Recogidas parciales

- Al enviar desde Corte se crea una entrega en proceso con recepcion version 1. El estado se calcula a partir de las cantidades recibidas y saldos: Activas mientras quede genero por recibir (incluidas recogidas parciales), Completadas totalmente cubiertas.
- Registrar recogida agrupa por confeccion, tela, talla y categoria (espacios extremos y mayusculas se normalizan). Reparte por fecha de envio ascendente, despues creacion e identificador. No mezcla categorias vacias con categorias conocidas. Es una asignacion contable, no una identificacion fisica del pedido.
- Cada entrega guarda sus cantidades recibidas en recepcion.lineas identificadas por talla/categoria. El JSON y la sincronizacion incluyen este campo. No se modifican las cantidades enviadas.
- Corregir recibidas permite cambiar el total acumulado por entrega y cerrar diferencias como saldo con motivo obligatorio. Al reabrir un saldo o reducir recibidas vuelve a quedar pendiente. Una correccion no redistribuye recogidas antiguas de otras entregas.
- Las entregas antiguas completadas conservan su estado, pero no se inventan sus recibidas. Se muestran con aviso y no se incluyen en el pendiente de fabrica hasta que se revisen.
- Se bloquean cambios de tela/talla o reducciones que invaliden recibidas o saldos. Para eliminar una entrega con recogidas hay que corregirlas primero.
- Pruebas adicionales: node tests/recepciones.cjs (sin datos reales).

## Empezar desde hoy

En Entregas, desplegar Empezar seguimiento desde hoy, revisar la lista y confirmar. Hasta esa confirmacion no se archiva ningun dato. Guarda una copia previa de recuperacion y ofrece Deshacer mientras no haya cambios posteriores.

Las entregas existentes pasan a Historico sin revisar mediante seguimiento.archivada; conservan cantidades y estado anterior, pero quedan fuera de los totales y del reparto de recogidas. No equivale a completarlas.

Recuperar pendientes conocidos crea un registro de apertura etiquetado Pendiente al iniciar, ligado al historico con referenciaHistorica. No lleva origenCorte para no duplicar lo enviado desde Corte. La cantidad inicial queda fija y el resto se gestiona con recibidas/saldos. Cada entrada historica puede recuperarse una vez; el identificador es estable para evitar duplicados entre dispositivos.

Las recogidas historicas se anotan por separado y pueden anularse. No descuentan pedidos activos y no pueden consumir unidades recuperadas para seguimiento. Los nuevos metadatos quedan incluidos en JSON y sincronizacion.

## Anulaciones de corte

Cada linea puede anular sus unidades pendientes con motivo y fecha, sin alterar unidades pedidas ni cortadas. Cerrar pedido con pendientes aplica esta operacion a las lineas no resueltas. Si todas las lineas estan cortadas o anuladas, aparece en Completados como Cerrado con anulaciones. Se pueden reabrir una o todas las lineas anuladas.

Las anuladas no cuentan en el badge ni en Pendientes. Solo las cantidades realmente cortadas siguen disponibles para enviar a Entregas. No se modifican entregas ni recogidas existentes. La anulacion se conserva en JSON y sincronizacion. Pruebas: node tests/corte-anulaciones.cjs.

## Marcado dentro de cada entrega

La ficha tiene un boton Entregado junto a las categorias de cada talla y un resumen compacto de recibidas/enviadas. El boton abre un cuadro para introducir el total acumulado recogido de esa talla/categoria, no solo la ultima recogida. Permite corregirlo a cero o a otra cantidad valida. Se confirma con Guardar. Se ha eliminado el bloque grande de casillas.

Las entregas permanecen en Activas con recogidas parciales y pasan a Completadas al cubrir todas sus lineas (recibidas o saldos). Ya no hay pestana Pendientes en Entregas; Historico se mantiene. La ficha solo modifica esa entrega, sin usar el reparto FIFO. Las recogidas globales siguen repartiendo entre las mas antiguas. Los saldos de las lineas no modificadas se conservan.

Pruebas: node tests/entrega-ficha.cjs.
