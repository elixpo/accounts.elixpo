"use client";

import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Stack,
    Typography,
} from "@mui/material";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * /dashboard/subscriptions — current billing state.
 *
 * Reads /api/auth/me for tier + renewal info. For now this is a thin
 * read-only view: shows which plan the user is on, when it renews, and
 * shortcuts to upgrade (/pricing) or cancel (support email until
 * self-serve cancel ships).
 *
 * When real recurring is live and we add a /api/billing/cancel that
 * actually cancels via Pay, this page picks that up via the cancel
 * button below.
 */

interface Me {
    id?: string;
    tier?: "hobby" | "indie" | "studio" | "internal";
    tier_renews_at?: string | null;
    is_internal?: boolean;
}

const TIER_META: Record<
    string,
    { name: string; accent: string; description: string }
> = {
    hobby: {
        name: "Hobby",
        accent: "rgba(245,245,244,0.85)",
        description: "Free. 1,000 MAU per app · 3 OAuth apps.",
    },
    indie: {
        name: "Indie",
        accent: "#9b7bf7",
        description: "10,000 MAU per app · 10 OAuth apps · 5 webhook endpoints.",
    },
    studio: {
        name: "Studio",
        accent: "#5fb6ff",
        description:
            "100,000 MAU per app · unlimited OAuth apps · audit log export.",
    },
    internal: {
        name: "Internal",
        accent: "#fbbf24",
        description: "Internal account — billing bypassed.",
    },
};

function formatDate(iso?: string | null): string | null {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    } catch {
        return iso;
    }
}

export default function SubscriptionsPage() {
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/auth/me", { credentials: "include" })
            .then(async (r) => (r.ok ? ((await r.json()) as any) : null))
            .then((d) => setMe((d?.user ?? d) as Me | null))
            .catch(() => setMe(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: "grid", placeItems: "center", py: 10 }}>
                <CircularProgress sx={{ color: "#9b7bf7" }} />
            </Box>
        );
    }

    const tier = me?.tier ?? "hobby";
    const meta = TIER_META[tier] ?? TIER_META.hobby;
    const renewsAt = formatDate(me?.tier_renews_at);
    const isPaid = tier === "indie" || tier === "studio";

    return (
        <Box sx={{ maxWidth: 760, mx: "auto" }}>
            <Typography
                sx={{
                    fontWeight: 800,
                    fontSize: "1.7rem",
                    letterSpacing: "-0.02em",
                    mb: 0.5,
                }}
            >
                Subscriptions
            </Typography>
            <Typography
                sx={{
                    color: "rgba(245,245,244,0.55)",
                    fontSize: "0.92rem",
                    mb: 3,
                }}
            >
                Your current plan, renewal date, and a way to upgrade or cancel.
            </Typography>

            <Box
                sx={{
                    p: { xs: 3, sm: 3.5 },
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(20,18,28,0.6)",
                    backdropFilter: "blur(12px)",
                }}
            >
                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                    sx={{ mb: 2.5 }}
                >
                    <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1.2} alignItems="center">
                            <Typography
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "1.25rem",
                                    color: meta.accent,
                                }}
                            >
                                {meta.name}
                            </Typography>
                            <Chip
                                label={isPaid ? "Active" : "Free"}
                                size="small"
                                sx={{
                                    height: 22,
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    color: isPaid ? "#86efac" : "rgba(245,245,244,0.7)",
                                    bgcolor: isPaid
                                        ? "rgba(134,239,172,0.12)"
                                        : "rgba(255,255,255,0.06)",
                                    border: isPaid
                                        ? "1px solid rgba(134,239,172,0.3)"
                                        : "1px solid rgba(255,255,255,0.1)",
                                }}
                            />
                        </Stack>
                        <Typography
                            sx={{
                                color: "rgba(245,245,244,0.65)",
                                fontSize: "0.9rem",
                            }}
                        >
                            {meta.description}
                        </Typography>
                    </Stack>
                    {!me?.is_internal && (
                        <Button
                            component={Link}
                            href="/pricing"
                            sx={{
                                textTransform: "none",
                                fontWeight: 700,
                                px: 2.4,
                                py: 1,
                                borderRadius: "10px",
                                color: "#fff",
                                background:
                                    "linear-gradient(135deg, #9b7bf7, #7c5cff)",
                                "&:hover": {
                                    background:
                                        "linear-gradient(135deg, #a78bfa, #8b6cff)",
                                },
                            }}
                        >
                            {isPaid ? "Change plan" : "Upgrade"}
                        </Button>
                    )}
                </Stack>

                {isPaid && renewsAt && (
                    <Box
                        sx={{
                            pt: 2,
                            borderTop: "1px solid rgba(255,255,255,0.06)",
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                            gap: 1.5,
                        }}
                    >
                        <Row label="Renews on" value={renewsAt} />
                        <Row label="Billing cycle" value="Monthly" />
                    </Box>
                )}
            </Box>

            {isPaid && !me?.is_internal && (
                <Box sx={{ mt: 3 }}>
                    <Typography
                        sx={{
                            fontWeight: 700,
                            fontSize: "1rem",
                            mb: 0.5,
                            color: "#f5f5f4",
                        }}
                    >
                        Cancel subscription
                    </Typography>
                    <Typography
                        sx={{
                            color: "rgba(245,245,244,0.55)",
                            fontSize: "0.88rem",
                            mb: 1.5,
                        }}
                    >
                        Self-serve cancellation isn't live yet. Email{" "}
                        <a
                            href="mailto:support@elixpo.com"
                            style={{ color: "#9b7bf7" }}
                        >
                            support@elixpo.com
                        </a>{" "}
                        and we'll cancel within one business day; you keep
                        access until the end of your current period.
                    </Typography>
                </Box>
            )}

            {me?.is_internal && (
                <Typography
                    sx={{
                        mt: 3,
                        color: "rgba(245,245,244,0.5)",
                        fontSize: "0.85rem",
                    }}
                >
                    Your account is marked internal — billing is bypassed.
                </Typography>
            )}
        </Box>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <Stack spacing={0.3}>
            <Typography
                sx={{
                    color: "rgba(245,245,244,0.45)",
                    fontSize: "0.74rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </Typography>
            <Typography
                sx={{
                    color: "rgba(245,245,244,0.9)",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                }}
            >
                {value}
            </Typography>
        </Stack>
    );
}
