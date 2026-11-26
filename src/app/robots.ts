import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/checkout", "/orders", "/verify-email"],
      },
    ],
    sitemap: "https://ultimate-wear.com/sitemap.xml",
  };
}
