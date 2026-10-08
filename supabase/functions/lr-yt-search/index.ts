// lofi.room — YouTube search for the playlist panel.
// GET ?q=<words>&type=video|playlist  ->  {items:[{k:'v'|'l', y, title, channel, length, thumb}]}
// Uses the YouTube Data API when a YT_API_KEY secret is set; otherwise asks
// YouTube's own web search endpoint (no key, no quota).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
type Item = { k: "v" | "l"; y: string; title: string; channel: string; length: string; thumb: string };

const txt = (t: any): string => !t ? "" : t.simpleText ?? t.content ?? (t.runs || []).map((r: any) => r.text).join("");
const lastThumb = (t: any): string => { const a = t?.thumbnails || t?.sources || []; return a.length ? a[Math.min(a.length - 1, 1)].url : ""; };

// Walk YouTube's JSON and pick out video and playlist results wherever they sit.
function collect(node: any, out: Item[], seen: Set<string>) {
  if (!node || typeof node !== "object" || out.length >= 40) return;
  if (Array.isArray(node)) { for (const n of node) collect(n, out, seen); return; }
  const v = node.videoRenderer;
  if (v?.videoId && !seen.has(v.videoId)) {
    seen.add(v.videoId);
    out.push({ k: "v", y: v.videoId, title: txt(v.title), channel: txt(v.ownerText || v.longBylineText), length: txt(v.lengthText) || (v.badges?.some((b: any) => b.metadataBadgeRenderer?.style?.includes("LIVE")) ? "LIVE" : ""), thumb: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` });
  }
  const p = node.playlistRenderer;
  if (p?.playlistId && !seen.has(p.playlistId)) {
    seen.add(p.playlistId);
    out.push({ k: "l", y: p.playlistId, title: txt(p.title), channel: txt(p.shortBylineText || p.longBylineText), length: p.videoCount ? p.videoCount + "곡" : "", thumb: lastThumb(p.thumbnails?.[0]) });
  }
  const l = node.lockupViewModel;
  if (l?.contentId && /PLAYLIST/.test(l.contentType || "") && !seen.has(l.contentId)) {
    seen.add(l.contentId);
    const md = l.metadata?.lockupMetadataViewModel;
    const rows = md?.metadata?.contentMetadataViewModel?.metadataRows || [];
    const channel = rows[0]?.metadataParts?.[0]?.text?.content || "";
    const img = l.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel;
    const badge = JSON.stringify(img?.overlays || []).match(/"text":"([^"]*\d[^"]*)"/);
    out.push({ k: "l", y: l.contentId, title: md?.title?.content || "", channel, length: badge ? badge[1] : "", thumb: lastThumb(img?.image) });
  }
  for (const key in node) if (key !== "videoRenderer" && key !== "playlistRenderer" && key !== "lockupViewModel") collect(node[key], out, seen);
}

async function viaWeb(q: string, type: string): Promise<Item[]> {
  // "EgIQAQ" = videos only, "EgIQAw" = playlists only
  const r = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json", "accept-language": "ko-KR,ko;q=0.9" },
    body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "ko", gl: "KR" } }, query: q, params: type === "playlist" ? "EgIQAw%3D%3D" : "EgIQAQ%3D%3D" }),
  });
  if (!r.ok) throw new Error("youtube " + r.status);
  const out: Item[] = []; collect(await r.json(), out, new Set()); return out;
}

async function viaApi(q: string, type: string, key: string): Promise<Item[]> {
  const u = new URL("https://www.googleapis.com/youtube/v3/search");
  Object.entries({ part: "snippet", q, type, maxResults: "20", regionCode: "KR", relevanceLanguage: "ko", key }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u); if (!r.ok) throw new Error("data api " + r.status);
  const j = await r.json();
  return (j.items || []).map((it: any) => ({ k: it.id.playlistId ? "l" : "v", y: it.id.videoId || it.id.playlistId, title: it.snippet.title, channel: it.snippet.channelTitle, length: "", thumb: it.snippet.thumbnails?.medium?.url || "" }));
}

// verify_jwt is off (the project's publishable key is not a JWT), so check the key here.
function knownKey(k: string | null): boolean {
  if (!k) return false;
  try { return Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}")).includes(k); } catch (_) { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  if (!knownKey(req.headers.get("apikey") || u.searchParams.get("apikey"))) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...CORS, "content-type": "application/json" } });
  const q = (u.searchParams.get("q") || "").trim().slice(0, 100);
  const type = u.searchParams.get("type") === "playlist" ? "playlist" : "video";
  const json = (b: unknown, status = 200, cache = "no-store") => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": cache } });
  if (!q) return json({ items: [] });
  try {
    const key = Deno.env.get("YT_API_KEY");
    let items: Item[] = [];
    if (key) { try { items = await viaApi(q, type, key); } catch (_) { items = []; } }
    if (!items.length) items = await viaWeb(q, type);
    items = items.filter((i) => type === "playlist" ? i.k === "l" : i.k === "v").filter((i) => i.title).slice(0, 20);
    return json({ items }, 200, "public, max-age=600");
  } catch (e) {
    return json({ items: [], error: String((e as Error).message || e) }, 502);
  }
});
