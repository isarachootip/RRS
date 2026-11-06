import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "./i18n/dictionaries";

/** ทุก URL ต้องขึ้นต้นด้วยภาษา (/th, /en) เพื่อ SEO */
export function middleware(req: NextRequest) {
  const first = req.nextUrl.pathname.split("/")[1] ?? "";
  if (isLocale(first)) return NextResponse.next();
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    "portalrrs.tamadee.online";
  const path = `/${DEFAULT_LOCALE}${req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname}${req.nextUrl.search}`;
  return NextResponse.redirect(`${proto}://${host}${path}`);
}

export const config = { matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)"] };
