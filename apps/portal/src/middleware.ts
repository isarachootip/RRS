import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "./i18n/dictionaries";

/** ทุก URL ต้องขึ้นต้นด้วยภาษา (/th, /en) เพื่อ SEO */
export function middleware(req: NextRequest) {
  const first = req.nextUrl.pathname.split("/")[1] ?? "";
  if (isLocale(first)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)"] };
