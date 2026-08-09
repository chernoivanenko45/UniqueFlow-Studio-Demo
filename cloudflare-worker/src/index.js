const TOKEN_TTL_SECONDS = 2 * 60 * 60;

function html(message, status = 200) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UniqueFlow Full Beta</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090d16;color:#f7f8ff;font:16px system-ui}.card{max-width:560px;margin:24px;padding:32px;border:1px solid #2b3550;border-radius:20px;background:#121827}h1{margin-top:0}p{color:#aebbd8;line-height:1.6}</style><div class="card"><h1>UniqueFlow Studio</h1><p>${message}</p></div>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

async function issueDownload(request, env) {
  if (String(env.BETA_OPEN).toLowerCase() !== "true") {
    return html("The current Full Beta testing group is closed.", 403);
  }

  const maxDownloads = Math.max(1, Number(env.BETA_MAX_DOWNLOADS) || 25);
  const totalDownloads = Number(await env.BETA_LINKS.get("downloads:total") || 0);
  if (totalDownloads >= maxDownloads) {
    return html("The current Full Beta testing group is full.", 403);
  }

  const token = crypto.randomUUID().replaceAll("-", "");
  await env.BETA_LINKS.put(`token:${token}`, "1", { expirationTtl: TOKEN_TTL_SECONDS });
  const target = new URL(`/file/${token}`, request.url);
  return new Response(null, {
    status: 302,
    headers: { location: target.toString(), "cache-control": "private, no-store" }
  });
}

async function serveFile(request, env, token) {
  if (!/^[a-f0-9]{32}$/i.test(token) || !(await env.BETA_LINKS.get(`token:${token}`))) {
    return html("This download link is invalid or has expired. Return to the beta page and request a fresh link.", 410);
  }

  const hasRange = request.headers.has("range");
  const object = await env.BETA_FILES.get(
    env.BETA_OBJECT_KEY,
    hasRange ? { range: request.headers } : undefined
  );
  if (!object) return html("The beta file is temporarily unavailable.", 503);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  headers.set("content-disposition", `attachment; filename="${env.BETA_FILENAME}"`);

  if (hasRange && object.range) {
    const offset = object.range.offset ?? Math.max(0, object.size - (object.range.suffix ?? object.size));
    const length = object.range.length ?? (object.size - offset);
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
  } else {
    headers.set("content-length", String(object.size));
  }

  if (request.method === "GET" && (!request.headers.has("range") || request.headers.get("range")?.startsWith("bytes=0-"))) {
    const day = new Date().toISOString().slice(0, 10);
    const countKey = `downloads:${day}`;
    const [previousDay, previousTotal] = await Promise.all([
      env.BETA_LINKS.get(countKey),
      env.BETA_LINKS.get("downloads:total")
    ]);
    await Promise.all([
      env.BETA_LINKS.put(countKey, String(Number(previousDay || 0) + 1), { expirationTtl: 90 * 24 * 60 * 60 }),
      env.BETA_LINKS.put("downloads:total", String(Number(previousTotal || 0) + 1))
    ]);
  }

  return new Response(request.method === "HEAD" ? null : object.body, { status: hasRange ? 206 : 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    if (url.pathname === "/download") return issueDownload(request, env);
    if (url.pathname.startsWith("/file/")) return serveFile(request, env, url.pathname.slice(6));
    if (url.pathname === "/status") {
      return Response.json({ open: String(env.BETA_OPEN).toLowerCase() === "true", version: "0.9.0-rc1" }, { headers: { "cache-control": "no-store" } });
    }
    return html("Full Beta downloads are available only through the official UniqueFlow Studio website.", 404);
  }
};
