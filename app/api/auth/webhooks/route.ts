export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/d1-client";
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

export async function GET(request: NextRequest) {
    const auth = await getAuth(request);
    if (!auth)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDatabase();
    const result = await db
        .prepare(
            `SELECT id, url, events, is_active, created_at, last_delivery_at
       FROM webhooks WHERE user_id = ? ORDER BY created_at DESC`,
        )
        .bind(auth.sub)
        .all();

    const webhooks = (result.results || []).map((w: any) => ({
        ...w,
        events:
            typeof w.events === "string"
                ? JSON.parse(w.events)
                : (w.events ?? []),
        is_active: Boolean(w.is_active),
    }));

    return NextResponse.json({ webhooks });
}

export async function POST(request: NextRequest) {
    const auth = await getAuth(request);
    if (!auth)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: any = await request.json();
    const { client_id, events, secret } = body as {
        client_id: string;
        events: string[];
        secret?: string;
    };

    // Per the safety policy, a user-scoped webhook can only target a URL
    // that's already registered on one of the caller's own OAuth apps.
    // This eliminates the free-text-URL SSRF / spam vector that the old
    // form allowed.
    if (!client_id || typeof client_id !== "string") {
        return NextResponse.json(
            { error: "client_id is required" },
            { status: 400 },
        );
    }
    if (!events || events.length === 0) {
        return NextResponse.json(
            { error: "At least one event is required" },
            { status: 400 },
        );
    }

    const db = await getDatabase();
    const app = await db
        .prepare(
            "SELECT client_id, name, webhook_url, owner_id FROM oauth_clients WHERE client_id = ? AND is_active = 1",
        )
        .bind(client_id)
        .first<{
            client_id: string;
            name: string;
            webhook_url: string | null;
            owner_id: string;
        }>();

    if (!app)
        return NextResponse.json(
            { error: "OAuth app not found" },
            { status: 404 },
        );
    if (app.owner_id !== auth.sub) {
        return NextResponse.json(
            {
                error: "You can only create webhooks pointing to OAuth apps you own",
            },
            { status: 403 },
        );
    }
    if (!app.webhook_url) {
        return NextResponse.json(
            {
                error: "Selected app has no webhook URL configured. Set one in OAuth Apps → app settings first.",
            },
            { status: 400 },
        );
    }

    const id = crypto.randomUUID();
    const webhookSecret = secret || crypto.randomUUID().replace(/-/g, "");

    await db
        .prepare(
            `INSERT INTO webhooks (id, user_id, client_id, url, events, secret, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        )
        .bind(
            id,
            auth.sub,
            app.client_id,
            app.webhook_url,
            JSON.stringify(events),
            webhookSecret,
        )
        .run();

    return NextResponse.json(
        {
            id,
            client_id: app.client_id,
            client_name: app.name,
            url: app.webhook_url,
            events,
            secret: webhookSecret,
            is_active: true,
        },
        { status: 201 },
    );
}
