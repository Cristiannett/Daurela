const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const PRECIO_ENTRADA_POR_TOKEN = 2 / 1e6;
const PRECIO_SALIDA_POR_TOKEN = 10 / 1e6;

function construirContexto(datos) {
  const lineas = [];

  const clientes = datos.clientes || [];
  if (clientes.length) {
    lineas.push("CLIENTES, TELAS Y MEDIDAS:");
    clientes.forEach(function (c) {
      lineas.push("- Cliente: " + c.nombre + (c.notas ? " (notas: " + c.notas + ")" : ""));
      (c.telas || []).forEach(function (t) {
        lineas.push("  - Tela: " + t.nombre + (t.notas ? " (notas: " + t.notas + ")" : ""));
        (t.medidas || []).forEach(function (m) {
          lineas.push(
            "    - Medida: " + m.nombre + ", tipo: " + m.tipo +
            ", taco: " + m.ta + ", cliente: " + m.cl +
            (m.obs ? ", obs: " + m.obs : "")
          );
        });
      });
    });
  }

  const fichajes = datos.fichajes || {};
  const fechasFich = Object.keys(fichajes).sort();
  if (fechasFich.length) {
    lineas.push("");
    lineas.push("FICHAJES (fecha: tipo, horas normales, horas extra):");
    fechasFich.forEach(function (f) {
      const d = fichajes[f];
      lineas.push(
        "- " + f + ": " + (d.tipo || "normal") +
        ", " + (d.norm || 0) + "h normales, " + (d.extra || 0) + "h extra" +
        (d.nota ? " (" + d.nota + ")" : "")
      );
    });
  }

  const notas = datos.notas || [];
  if (notas.length) {
    lineas.push("");
    lineas.push("NOTAS:");
    notas.forEach(function (n) {
      lineas.push("- [" + (n.done ? "hecha" : "pendiente") + "] " + n.fecha + " " + n.hora + ": " + n.txt);
    });
  }

  const entregas = datos.entregas || [];
  if (entregas.length) {
    lineas.push("");
    lineas.push("ENTREGAS A CONFECCIONES:");
    entregas.forEach(function (e) {
      const tallas = (e.lineas || []).map(function (l) { return l.talla + ": " + l.uds; }).join(", ");
      lineas.push(
        "- " + e.conf + " | estado: " + e.estado +
        " | entrega: " + e.fentrega + " | recogida: " + e.frecogida +
        " | tallas: " + tallas +
        (e.materiales ? " | materiales: " + e.materiales : "") +
        (e.obs ? " | obs: " + e.obs : "")
      );
    });
  }

  const inventarios = datos.inventarios || [];
  if (inventarios.length) {
    lineas.push("");
    lineas.push("ALMACEN (inventarios mensuales):");
    inventarios.forEach(function (inv) {
      lineas.push("- " + (inv.titulo || inv.mesKey));
      const zonas = inv.zonas || {};
      Object.keys(zonas).forEach(function (zk) {
        const telas = (zonas[zk].telas || []).map(function (t) {
          return t.nombre + ": " + String(t.metros || "").replace(/^_/, "");
        });
        if (telas.length) lineas.push("  - " + zk + ": " + telas.join(", "));
      });
    });
  }

  const pedidos = datos.pedidos || [];
  if (pedidos.length) {
    lineas.push("");
    lineas.push("PEDIDOS GUARDADOS (calculadora):");
    pedidos.forEach(function (p) {
      lineas.push("- " + p.nombre + " (" + p.fecha + "), margen: " + p.margen + ", pieza: " + p.pieza + "m");
    });
  }

  return lineas.join("\n") || "(Sin datos guardados todavia)";
}

async function registrarUso(db, uid, usage) {
  if (!usage) return;
  const inputTok = usage.input_tokens || 0;
  const outputTok = usage.output_tokens || 0;
  const coste = inputTok * PRECIO_ENTRADA_POR_TOKEN + outputTok * PRECIO_SALIDA_POR_TOKEN;
  const mes = new Date().toISOString().slice(0, 7);
  const ref = db.collection("usuarios").doc(uid).collection("uso_ia").doc(mes);
  await ref.set({
    preguntas: FieldValue.increment(1),
    inputTokens: FieldValue.increment(inputTok),
    outputTokens: FieldValue.increment(outputTok),
    costeEstimado: FieldValue.increment(coste)
  }, { merge: true });
}

exports.chatbot = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion para usar el asistente.");
  }
  const uid = request.auth.uid;
  const pregunta = String((request.data && request.data.pregunta) || "").trim();
  if (!pregunta) {
    throw new HttpsError("invalid-argument", "Falta la pregunta.");
  }

  const db = getFirestore();
  const snap = await db.collection("usuarios").doc(uid).get();
  const datos = snap.exists ? snap.data() : {};
  const contexto = construirContexto(datos);

  let respuestaClaude;
  try {
    respuestaClaude = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey.value(),
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        system:
          "Eres el asistente del taller textil Daurela. Responde en espanol, de forma breve y concreta, " +
          "basandote unicamente en los datos de contexto proporcionados. Si la pregunta requiere sumar o " +
          "calcular a partir de una lista larga (por ejemplo horas de todo un anyo), da directamente el " +
          "resultado final, sin listar cada entrada una por una. Si no tienes datos suficientes para " +
          "responder con certeza, dilo claramente en vez de inventar.",
        messages: [
          { role: "user", content: "Contexto de datos del taller:\n" + contexto + "\n\nPregunta: " + pregunta }
        ]
      })
    });
  } catch (e) {
    console.error("Fallo de red llamando a Claude:", e);
    throw new HttpsError("unavailable", "No se pudo contactar con el asistente.");
  }

  if (!respuestaClaude.ok) {
    const errText = await respuestaClaude.text();
    console.error("Error de la API de Claude:", respuestaClaude.status, errText);
    throw new HttpsError("internal", "El asistente devolvio un error.");
  }

  const json = await respuestaClaude.json();
  const bloquesTexto = (json.content || [])
    .filter(function (b) { return b.type === "text" && b.text; })
    .map(function (b) { return b.text; });
  let texto = bloquesTexto.join("\n").trim();

  if (!texto) {
    console.error("Respuesta vacia de Claude. stop_reason:", json.stop_reason, "content:", JSON.stringify(json.content));
    texto = "El asistente no genero texto (motivo: " + (json.stop_reason || "desconocido") + "). Intenta reformular la pregunta o hacerla mas concreta.";
  }

  await registrarUso(db, uid, json.usage);

  return { respuesta: texto };
});

exports.extraerPedido = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }
  const uid = request.auth.uid;
  const texto = String((request.data && request.data.texto) || "").trim();
  if (!texto) {
    throw new HttpsError("invalid-argument", "Falta el texto del pedido.");
  }

  let respuestaClaude;
  try {
    respuestaClaude = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey.value(),
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system:
          "Extraes datos de un mensaje de pedido de un cliente de un taller textil (puede venir como texto " +
          "normal, o como una tabla pegada con tabulaciones, espacios o guiones separando columnas, con " +
          "cabecera tipo CODIGO-SERIE-TAMANO-UNIDADES-CAJAS). Cada linea de pedido suele ser una serie/medida " +
          "con su cantidad (ej: '90x190 x4', 'taco 135 x2', 'Bamboo 135 x96'). Ignora columnas de codigo de " +
          "producto (no aportan nada para cortar), saludos, firmas y cualquier texto que no sea parte del " +
          "pedido en si. Si la linea indica tambien un numero de cajas, incluyelo al final entre parentesis, " +
          "ej: 'Bamboo 135 x96 (16 cajas)'; si no hay dato de cajas, no lo inventes ni lo incluyas. Busca " +
          "tambien si el mensaje menciona un numero de pedido (ej: 'Pedido nº 4521', 'Ref: 4521', 'Pedido " +
          "4521'); si no aparece ninguno, deja ese campo vacio, no lo inventes. Devuelve SOLO un objeto JSON " +
          "con esta forma exacta: {\"numeroPedido\": \"...\", \"items\": [\"...\", \"...\"]}. El array items " +
          "son las lineas del pedido tal cual deberian quedar en una lista de corte, sin numeracion ni " +
          "vinetas. Si no encuentras ninguna linea clara, items debe ser un array vacio [].",
        messages: [
          { role: "user", content: texto }
        ]
      })
    });
  } catch (e) {
    console.error("Fallo de red llamando a Claude (extraerPedido):", e);
    throw new HttpsError("unavailable", "No se pudo contactar con el servicio.");
  }

  if (!respuestaClaude.ok) {
    const errText = await respuestaClaude.text();
    console.error("Error de la API de Claude (extraerPedido):", respuestaClaude.status, errText);
    throw new HttpsError("internal", "El servicio devolvio un error.");
  }

  const json = await respuestaClaude.json();
  const bloquesTexto = (json.content || [])
    .filter(function (b) { return b.type === "text" && b.text; })
    .map(function (b) { return b.text; });
  const textoRespuesta = bloquesTexto.join("\n").trim();

  let items = [];
  let numeroPedido = "";
  try {
    const match = textoRespuesta.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : textoRespuesta);
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed && typeof parsed === "object") {
      items = Array.isArray(parsed.items) ? parsed.items : [];
      numeroPedido = String(parsed.numeroPedido || "").trim();
    }
  } catch (e) {
    console.error("No se pudo parsear la respuesta de extraerPedido:", textoRespuesta);
    items = [];
  }
  items = items.map(function (i) { return String(i || "").trim(); }).filter(function (i) { return i; });

  const db = getFirestore();
  await registrarUso(db, uid, json.usage);

  return { items: items, numeroPedido: numeroPedido };
});
