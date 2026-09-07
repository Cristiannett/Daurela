# CLAUDE.md — Contexto del proyecto Daurela

## ¿Qué es Daurela?
PWA (Progressive Web App) para gestión de un taller textil de confección de protectores de cama y fundas de almohada.

## URLs
- **App en producción:** https://cristiannett.github.io/Daurela/
- **Repositorio:** https://github.com/Cristiannett/Daurela
- **Firebase proyecto:** daurela-5d59c

## Arquitectura técnica

### Archivos
- `index.html` — toda la app (HTML + CSS + JS en un solo archivo)
- `sw.js` — Service Worker para funcionamiento offline

### Scripts en index.html
Hay **2 scripts** de tipo `type="module"`:
1. **Script Firebase** — importa SDK de Firebase, configura auth y Firestore, expone `window._fireAuth`, `window._fireDB`, `window._fireProvider`, `window._fireFns`, `window._fireUser`
2. **Script principal** — toda la lógica de la app

### Firebase
- Auth: Google (login con cuenta Google)
- Firestore: colección `usuarios/{uid}` — solo el propio usuario puede leer/escribir
- Sync automático: cada vez que se guarda algo, 1.5s después se sube a Firestore
- Merge: combina datos locales y remotos sin perder nada

### Almacenamiento local
- `localStorage` como fuente principal (funciona offline)
- Firebase como backup en la nube en tiempo real
- GitHub como backup manual (JSON exportable)

---

## REGLAS CRÍTICAS — NUNCA IGNORAR

### 1. `type="module"` y scope global
El script principal es `type="module"`. Las funciones y variables NO son globales automáticamente. **Todo lo que se use en `onclick=""` debe estar expuesto al window:**
```js
try{window.miFuncion=miFuncion;}catch(e){}
```

### 2. Variables de estado — exponer al window
Variables como `curCli`, `curTela`, `curMed`, `almDetalleKey` se usan en `onclick` del HTML. Deben sincronizarse con `window` cuando se setean:
```js
curCli = db.clientes.find(...);
window.curCli = curCli; // OBLIGATORIO
```

### 3. Strings con `\n` — PROHIBIDO en módulos ES6
Los `\n` dentro de strings en módulos ES6 causan pantalla negra silenciosa. Usar siempre:
```js
const NL = String.fromCharCode(10);
lines.join(NL); // en vez de '\n'
```

### 4. Comillas anidadas en innerHTML — PROHIBIDO
Construir HTML con strings que contengan comillas escapadas (`\'`) dentro de módulos causa pantalla negra. Usar siempre `createElement`:
```js
// MAL: el.innerHTML = '<div onclick="fn(\''+id+'\')">'
// BIEN: usar createElement y .onclick = function(){}
```

### 5. `const uid` — nombre reservado
`uid()` es una función del script principal. Dentro de `syncFirestore` e `initFirestore` usar `const _uid = window._fireUser.uid` (no `const uid`).

### 6. `async function` sin module — PROHIBIDO
Solo se puede usar `async function` dentro de scripts `type="module"`. Las funciones async que existen (`exportarGitHub`, `fetchWeather`, `syncFirestore`, `loginGoogle`) ya están en el script module.

### 7. No llamar funciones DOM en el INIT
No llamar funciones que accedan a elementos de pantallas inactivas durante el arranque. Solo llamarlas desde `go()` cuando se navega a esa pantalla.

### 8. Firestore y texto libre
Firestore puede interpretar "1 palet y medio" como número 1. Solución: prefijo `_` al guardar, quitarlo al mostrar:
```js
// Al guardar en Firebase:
metros: '_' + String(t.metros||'')
// Al mostrar:
(t.metros||'').replace(/^_/,'')
```

---

## Metodología para añadir funcionalidades

**SIEMPRE seguir este orden — nunca saltarse pasos:**

1. Añadir HTML vacío (pantallas, botones) sin JS
2. Añadir funciones JS **vacías** (solo el esqueleto)
3. Probar en el emulador de Claude o en el móvil
4. Añadir lógica real **función por función**
5. Probar después de cada función
6. Subir a GitHub solo cuando todo funciona

**Si algo se rompe:** `git checkout index.html` para volver al estado anterior.

---

## Funcionalidades implementadas

### Gestión textil
- **Clientes** — grid de iconos estilo iOS con iniciales y colores
- **Telas** — lista con drag & drop por cliente
- **Medidas** — lista con drag & drop, eliminar directo
- **Detalle de medida** — taco/corte con observaciones
- **Búsqueda global**
- **Formularios** con confirmación al salir si hay cambios

### Calculadora
- Pedidos con margen y largo de pieza en metros
- Líneas de talla + unidades dinámicas
- **Pedidos guardados** con nombre y fecha
- Cargar pedido guardado en calculadora

### Fichaje
- Calendario mensual
- Tipos de día: Normal / Vacaciones / Festivo / Libre
- Horas normales + extras acumuladas
- Exportar resumen por WhatsApp
- Configuración de jornada

### Notas
- Historial diario con filtros (Todas / Pendientes / Completadas)
- Barra de input fija fuera de la pantalla (global)
- Badge rojo con número de pendientes en menú

### Almacén
- Inventario mensual por ubicaciones:
  - Pasillo 1 · Izquierda → Arriba / Medio / Abajo
  - Pasillo 2 · Derecha → Arriba / Medio / Abajo
  - Zona carros → Don Almohadon / Francisco Pastor / Valentia-Mommy / Viscofoam
- Múltiples telas por ubicación (nombre + metros como texto libre)
- Historial de meses anteriores
- Editar y duplicar inventarios
- Compartir por WhatsApp
- Sync con Firebase (metros con prefijo `_` para evitar conversión a número)

### Entregas
- Agenda de envíos a confecciones externas
- Confecciones: Mercedes (Oporto/Berlin/Bamboo), Mamoud (Paris/Lisboa/Viena/Roma), Bordador (Bari/Dreamline)
- Desplegables encadenados: confección → tela
- Líneas de talla + unidades dinámicas
- Estado: Pendiente / En proceso / Completado
- Materiales entregados y observaciones
- Editar y eliminar

### Firebase y sync
- Login con Google
- Sync automático 1.5s tras cualquier guardado
- Merge sin pérdida de datos (combina local + remoto)
- Indicador de sync: naranja (sincronizando) / verde (guardado) / rojo (error)
- Botón de usuario en topbar con foto de perfil

### UI/UX
- Menú principal grid de iconos iOS con gradientes
- Splash screen al arrancar
- Easter egg (long press en logo → confeti + vibración)
- Animaciones slide-in/slide-back entre pantallas
- Botón atrás Android (popstate)
- FAB global (aparece/desaparece según pantalla)
- Badges: rojo en Notas (pendientes), verde en Calculadora (pedidos guardados)
- Aviso de almacenamiento bajo (aparece abajo, desaparece en 5s)
- Modo oscuro automático
- Fuente Inter, tamaño configurable (sm/md/lg/xl)
- Service Worker para funcionamiento offline

### Backup
- Exportar JSON completo
- Exportar CSV
- Subir a GitHub (token guardado en localStorage)
- Restaurar desde JSON

---

## Estructura de datos en localStorage

| Key | Contenido |
|-----|-----------|
| `textil_v3` | db principal (clientes, telas, medidas) |
| `notas_v1` | array de notas |
| `fichajes_YYYY` | objeto con fechas como keys |
| `fich_jornada` | horas de jornada configuradas |
| `pedidos_v1` | array de pedidos guardados calculadora |
| `almacen_v1` | array de inventarios mensuales |
| `entregas_v1` | array de entregas a confecciones |
| `gh_token` | token de GitHub para backup |
| `font_size` | tamaño de fuente preferido |

---

## Reglas de Firestore
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Dominio autorizado en Firebase Auth
`cristiannett.github.io`
