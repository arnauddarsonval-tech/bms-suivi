import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Reconstruction (sept. 2026) : la fonction d'origine avait le même contrat (même jeton, même route,
// même forme de requête/réponse observée côté client dans le bookmarklet/script Fabrication Sachets), mais son
// code source n'a pas été retrouvé — reconstruite à l'identique du mécanisme, sur le même modèle que
// /api/plants. POST (avec Bearer) enregistre le dernier export scrapé depuis l'écran BMS Fabrication ;
// GET (public, lecture seule) le relit pour le tableau de bord.
//
// CORS (ajouté sept. 2026) : le POST est envoyé par un script (bookmarklet ou script Tampermonkey)
// qui s'exécute sur us1.erp.boostmyshop.com, donc DEPUIS UN AUTRE DOMAINE que bms-suivi.netlify.app.
// Un POST avec un header Authorization + Content-Type: application/json est une requête "non simple" :
// le navigateur envoie d'abord une requête OPTIONS (preflight). Sans réponse CORS explicite à cette
// OPTIONS (et sans Access-Control-Allow-Origin sur la vraie réponse), le navigateur bloque l'appel
// et le fetch() échoue avec "Failed to fetch" côté script, même si la fonction elle-même fonctionne.
// C'est ce qui a cassé l'export automatique après un redéploiement où cette gestion avait été omise.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const TOKEN = "BKM825mckjBKsPKRTCpc3mqlO75OP9Zx";
const KEY = "fabrication-export";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const store = getStore("bms-suivi");

  if (req.method === "POST") {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${TOKEN}`) {
      return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
    }
    await store.setJSON(KEY, body as Record<string, unknown>);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (req.method === "GET") {
    const data = await store.get(KEY, { type: "json" });
    return new Response(JSON.stringify(data || { rows: [] }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
};

export const config: Config = {
  path: "/api/fabrication",
};
