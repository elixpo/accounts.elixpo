export const runtime = "edge";

import { NextResponse } from "next/server";

/**
 * GET /api/well-known/microsoft-identity-association
 *
 * Served (via a rewrite in next.config.ts) at
 *   /.well-known/microsoft-identity-association.json
 *
 * Microsoft Entra (Azure AD) reads this file to verify that our app
 * registration's "publisher domain" actually belongs to us. Once the
 * domain is verified, the AAD consent screen drops the "Unverified"
 * warning and shows the elixpo.com publisher label.
 *
 * Why a route handler instead of a static file? Next.js + next-on-pages
 * ignores `public/.well-known/` (dot-prefixed dirs aren't reliably
 * picked up), so we serve the JSON from app router + rewrite the
 * canonical Microsoft URL onto this path.
 *
 * Keep the applicationId in sync with the GUID shown in Azure Portal →
 * App registrations → (this app) → Branding & properties → Publisher
 * domain.
 */
export function GET() {
    return NextResponse.json({
        associatedApplications: [
            { applicationId: "0aa1bd14-90db-4b27-b14b-598f96f41839" },
        ],
    });
}
