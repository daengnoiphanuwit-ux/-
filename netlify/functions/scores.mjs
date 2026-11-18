import { getStore } from "@netlify/blobs";

const MAX_ROWS = 500;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const clean = (s) =>
  String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 12) || "ไม่ระบุชื่อ";

export default async (req) => {
  const store = getStore("reaction");
  const rows = (await store.get("top", { type: "json" })) || [];

  if (req.method === "GET") {
    const me = new URL(req.url).searchParams.get("me") || "";
    return json({
      rows: rows.slice(0, 100).map((r) => ({ name: r.name, best: r.best, me: r.id === me })),
    });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const id = String(body.id || "");
    const best = Math.round(Number(body.best));
    if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return json({ error: "bad id" }, 400);
    if (!Number.isFinite(best) || best < 100 || best > 3000) return json({ error: "bad score" }, 400);

    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) rows.push({ id, name: clean(body.name), best, at: Date.now() });
    else if (best < rows[i].best) rows[i] = { id, name: clean(body.name), best, at: Date.now() };
    rows.sort((a, b) => a.best - b.best);
    rows.length = Math.min(rows.length, MAX_ROWS);
    await store.setJSON("top", rows);

    const pos = rows.findIndex((r) => r.id === id);
    return json({ rank: pos === -1 ? null : pos + 1, total: rows.length });
  }

  return json({ error: "method not allowed" }, 405);
};

export const config = { path: "/api/scores" };
