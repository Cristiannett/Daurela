# Almacén: recuento mensual

El recuento conserva la distribución por pasillos, niveles y carros. Las zonas y filas son desplegables; cada fila edita nombre, metros, piezas y observaciones. Un datalist ofrece los nombres presentes en recuentos anteriores y en las telas de clientes.

## Guardado

Cada cambio se guarda inmediatamente en `almacen_v1` y programa la sincronización habitual. El indicador local no confirma una subida a Firebase: el indicador general de sincronización informa de esa operación. El inventario lleva `borrador: true` hasta revisar todas las ubicaciones y pulsar **Finalizar recuento**. Modificar o eliminar una fila vuelve a dejar su ubicación sin revisar y el mes como borrador. Una ubicación vacía también se puede marcar revisada.

Los cambios se combinan contra la versión con la que se abrió el mes y la última copia local. Las filas usan identificadores estables. Si hay cambios incompatibles, no se sobrescribe silenciosamente: se conserva una copia de recuperación, se indica que el cambio no está guardado y se ofrece reabrir la versión guardada. Si falla localStorage, no se informa de éxito. La sincronización de Firebase mantiene además sus propios controles de conflictos.

## Compatibilidad y cantidades

Los registros nuevos usan `version: 2`; se conserva el campo `metros` como texto para aceptar decimales españoles y borradores intermedios. `piezas` y `notas` son campos separados. Un número seguido de `m` también se reconoce para compatibilidad. No se convierten textos como «1 palet y medio» ni se mezclan piezas con metros.

Al abrir un inventario antiguo para editarlo, el texto no numérico de `metros` se traslada a observaciones en la copia de edición. El registro guardado solo cambia cuando se realiza una acción. Las cantidades antiguas y notas siguen siendo legibles en el historial y WhatsApp. El resumen agrupa nombres ignorando mayúsculas y espacios de los extremos, conservando las ubicaciones en el detalle. No intenta adivinar equivalencias entre nombres distintos.

## Nuevo mes

**Nuevo mes** crea un recuento vacío y rechaza meses existentes. **Preparar siguiente recuento** conserva nombres y ubicaciones, deja las nuevas cantidades vacías y todas las ubicaciones sin revisar. El campo `anterior` conserva metros, piezas y notas anteriores como referencia visible al desplegar la fila. Esa referencia nunca entra en los nuevos totales.

Eliminar una tela ofrece Deshacer durante diez segundos. Compartir selecciona explícitamente el editor actual o el mes histórico mostrado y señala si es borrador. El botón atrás del móvil recorre detalle → historial → almacén → inicio.

Las copias JSON incluyen cantidades, notas, revisiones y referencias; siguen aceptándose los inventarios antiguos. No se cambia automáticamente ningún inventario real durante la publicación.

## Verificación

`node tests/almacen.cjs`: datos ficticios para decimales, texto libre, autosave, reapertura, piezas, revisiones, borradores, eliminación y recuperación, preparación de meses, WhatsApp, JSON, concurrencia y errores de almacenamiento. El montaje de pantallas se comprueba con DOM simulado; no sustituye una revisión visual en el teléfono.

## Cliente y formato
Cada fila admite un cliente opcional (sugerido o escrito libremente) en cualquier ubicación y el selector Piezas enteras / Tacos. La cantidad se conserva al cambiar el selector; los totales separan piezas de tacos y agrupan las telas por cliente y nombre. Para mezclar ambos formatos de una tela, se añaden dos filas. Cliente y formato se conservan en el siguiente recuento, las copias y WhatsApp. Las filas anteriores siguen siendo piezas y no reciben un cliente supuesto a partir del carro.
