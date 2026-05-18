---
title: Cloudflare Workers 反向代理 Emby 脚本
date: 2026-05-19
draft: false
archive: true
badge: Workers
---


## Cloudflare Workers 反向代理 Emby 脚本，支持网页自动跳转

```javascript
const UPSTREAM = "源服务器地址";

export default {
  async fetch(request, env, ctx) {
    const userAgent = request.headers.get("User-Agent") || "";
    if (userAgent.includes("Mozilla")) {
      return Response.redirect("网页访问跳转地址", 302);
    }

    const url = new URL(request.url);
    const upstreamUrl = new URL(UPSTREAM);

    url.protocol = upstreamUrl.protocol;
    url.hostname = upstreamUrl.hostname;
    url.port = upstreamUrl.port;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Host", upstreamUrl.hostname);
    requestHeaders.set("X-Forwarded-Host", url.hostname);
    requestHeaders.set("X-Forwarded-Proto", new URL(request.url).protocol.replace(":", ""));

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      return await fetch(url.toString(), {
        method: request.method,
        headers: requestHeaders,
      });
    }

    let response = await fetch(url.toString(), {
      method: request.method,
      headers: requestHeaders,
      body: request.body,
      redirect: "manual",
    });

    const pathname = url.pathname.toLowerCase();
    const isImage = pathname.includes("/images/") || pathname.match(/\.(jpg|jpeg|png|webp|gif|svg|ico)$/i);

    if (isImage && response.status === 200) {
      response = new Response(response.body, response);
      response.headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=86400");
    }

    return response;
  },
};
```
