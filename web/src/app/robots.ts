import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${base()}/sitemap.xml` };
}

function base() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://algorecall-eta.vercel.app";
}
