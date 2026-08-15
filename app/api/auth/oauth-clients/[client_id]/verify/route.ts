export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/d1-client";
import { getOAuthClientByIdWithSecret, updateOAuthClient, logAuditEvent } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import { generateUUID } from "@/lib/webcrypto";

/**
 * POST /api/auth/oauth-clients/[client_id]/verify
 *
 * Verifies domain ownership of the client's homepage_url by fetching:
 * https://<domain>/.well-known/elixpo-challenge.txt
 * Expects the file content to match: elixpo-challenge-<client_id>
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ client_id: string }> },
) {
    try {
        const token = request.cookies.get("access_token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = await verifyJWT(token);
        if (!payload) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        const { client_id } = await params;
        if (!client_id) {
            return NextResponse.json({ error: "client_id is required" }, { status: 400 });
        }

        const db = await getDatabase();

        // Verify ownership
        const app = (await getOAuthClientByIdWithSecret(db, client_id)) as any;
        if (!app) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }
        if (app.owner_id !== payload.sub) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const homepageUrl = app.homepage_url;
        if (!homepageUrl) {
            return NextResponse.json({
                error: "A homepage URL is required before verification. Configure it first in the settings panel."
            }, { status: 400 });
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(homepageUrl);
        } catch {
            return NextResponse.json({ error: "Invalid homepage URL format" }, { status: 400 });
        }

        const hostname = parsedUrl.hostname;
        const challengeUrl = `https://${hostname}/.well-known/elixpo-challenge.txt`;
        const expectedChallenge = `elixpo-challenge-${client_id}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(challengeUrl, {
                method: "GET",
                signal: controller.signal,
                headers: {
                    "User-Agent": "ElixpoAccountsDomainVerifier/1.0",
                    "Cache-Control": "no-cache",
                },
            }).finally(() => clearTimeout(timeoutId));

            if (!res.ok) {
                return NextResponse.json({
                    error: `Verification file not found. Fetch returned status code: ${res.status}. Check that it exists at ${challengeUrl}`
                }, { status: 400 });
            }

            const bodyText = (await res.text()).trim();
            if (bodyText !== expectedChallenge) {
                return NextResponse.json({
                    error: `Verification mismatch. Expected file content to equal: '${expectedChallenge}' (received: '${bodyText.slice(0, 100)}')`
                }, { status: 400 });
            }

            // Verify redirect URIs are subdomains of homepage host (for security)
            const redirectUris = JSON.parse(app.redirect_uris || "[]") as string[];
            for (const uri of redirectUris) {
                try {
                    const redirectHost = new URL(uri).hostname.toLowerCase();
                    const homepageHost = hostname.toLowerCase();
                    if (redirectHost !== homepageHost && !redirectHost.endsWith("." + homepageHost)) {
                        return NextResponse.json({
                            error: `For security, all registered redirect URIs must belong to the verified domain or its subdomains. URI '${uri}' does not match '${hostname}'.`
                        }, { status: 400 });
                    }
                } catch {
                    return NextResponse.json({ error: `Malformed redirect URI registered: ${uri}` }, { status: 400 });
                }
            }

            // Perform DB update
            await updateOAuthClient(db, client_id, { isBrandingVerified: true });

            // Log audit trail
            await logAuditEvent(db, {
                id: generateUUID(),
                userId: payload.sub,
                eventType: "client.branding_verified",
                provider: client_id,
                status: "success",
            }).catch(() => {});

            return NextResponse.json({
                ok: true,
                message: "Custom branding and domain verified successfully"
            });
        } catch (fetchErr: any) {
            const isTimeout = fetchErr.name === "AbortError";
            return NextResponse.json({
                error: isTimeout
                    ? `Verification timeout. The server at ${challengeUrl} took too long to respond (3s limit).`
                    : `Network error connecting to ${challengeUrl}. Check that your server is running and accessible over public HTTPS.`
            }, { status: 400 });
        }
    } catch (error) {
        console.error("[OAuth Client] Verification endpoint error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
