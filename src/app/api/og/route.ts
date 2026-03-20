import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    new URL(url); // validate
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TensionBot/1.0 (+https://tension.app)" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 200 });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return NextResponse.json({ error: "Not HTML" }, { status: 200 });

    const html = await res.text();

    function getMeta(property: string): string | null {
      const ogMatch = html.match(new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, "i"))
        ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, "i"));
      if (ogMatch) return ogMatch[1];
      if (property === "title") {
        const twitterMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
        if (twitterMatch) return twitterMatch[1];
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) return titleMatch[1].trim();
      }
      if (property === "description") {
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
        if (descMatch) return descMatch[1];
      }
      return null;
    }

    const title = getMeta("title");
    const description = getMeta("description");
    const image = getMeta("image");
    const siteName = getMeta("site_name");

    if (!title && !description) return NextResponse.json({ error: "No preview data" }, { status: 200 });

    return NextResponse.json({ title, description, image, siteName, url });
  } catch {
    return NextResponse.json({ error: "Fetch error" }, { status: 200 });
  }
}
