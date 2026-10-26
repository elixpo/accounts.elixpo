import type { MetadataRoute } from "next";

export const runtime = "edge";

const BASE_URL = "https://accounts.elixpo.com";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: [
                    "/",
                    "/login",
                    "/register",
                    "/about",
                    "/pricing",
                    "/docs/",
                    "/privacy",
                    "/terms",
                    "/.well-known/openid-configuration",
                    "/.well-known/oauth-authorization-server",
                    "/llms.txt",
                ],
                // /authorize and /oauth/authorize are deliberately crawlable:
                // third-party "Sign in with Elixpo" links point at them, and
                // crawlers must be able to see their noindex / follow the
                // redirect to the canonical /login rather than index a bare URL.
                disallow: [
                    "/api/",
                    "/dashboard",
                    "/mfa",
                    "/device",
                    "/verify",
                    "/setup-name",
                    "/forgot-password",
                    "/error",
                    "/callback/",
                ],
            },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
        host: BASE_URL,
    };
}
