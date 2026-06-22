export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";

async function getAuth(request: NextRequest) {
    const token =
        request.cookies.get("access_token")?.value ||
        request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const payload = await verifyJWT(token);
    if (payload?.type !== "access") return null;
    return payload;
}

/**
 * POST /api/billing/cancel
 *
 * STUB: returns 501. Cancelling a recurring subscription requires a
 * server-to-server call to payouts.elixpo's (not-yet-built) v1
 * subscription cancel endpoint, which then calls Razorpay's cancel API
 * and fires entitlement.updated back to us.
 *
 * Path forward (in payouts.elixpo):
 *   - Build POST /v1/subscriptions/cancel { uid, cancel_at_cycle_end? }
 *   - It looks up the user's active subscription by (app_id, external_uid),
 *     calls razorpay.cancelSubscription(...), and lets the
 *     subscription.cancelled webhook fire entitlement.updated.
 *
 * Until then, users who want to cancel reach out via support@elixpo.com
 * and we cancel manually from the Pay dashboard. The graceful-period
 * semantics (keep access until period_end) are baked into the schema
 * already, so manual cancels are safe.
 */
export async function POST(request: NextRequest) {
    const auth = await getAuth(request);
    if (!auth)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(
        {
            error: "Self-serve cancellation isn't live yet. Email support@elixpo.com and we'll cancel within one business day; you keep access until the end of your current period.",
            contact: "support@elixpo.com",
        },
        { status: 501 },
    );
}
