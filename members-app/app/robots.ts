import type { MetadataRoute } from "next";

// app.defisurfers.xyz é a ferramenta privada de membros — nada a indexar.
// O SEO público vive em defisurfers.xyz (hub) e drops.defisurfers.xyz.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
