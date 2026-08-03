"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { generatePixelAvatar } from "@/lib/pixel-avatar";
import type { ScopeDefinition } from "@/lib/scopes";

type ViewState =
    | { kind: "enter_code" }
    | { kind: "loading" }
    | { kind: "invalid" }
    | { kind: "expired" }
    | { kind: "already_used"; status: "approved" | "denied" | "consumed" }
    | { kind: "requires_login" }
    | {
          kind: "confirm";
          id: string;
          clientName: string;
          scopes: ScopeDefinition[];
          account: { email: string; displayName: string | null };
      }
    | { kind: "approved" }
    | { kind: "denied" }
    | { kind: "error"; message: string };

function DeviceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [codeInput, setCodeInput] = useState(searchParams.get("user_code") || "");
    const [view, setView] = useState<ViewState>({ kind: "enter_code" });
    const [submitting, setSubmitting] = useState(false);

    async function lookup(code: string) {
        setView({ kind: "loading" });
        try {
            const res = await fetch(
                `/api/auth/device/verify?user_code=${encodeURIComponent(code)}`,
                { credentials: "include" },
            );
            if (res.status === 401) {
                setView({ kind: "requires_login" });
                return;
            }
            if (res.status === 404) {
                setView({ kind: "invalid" });
                return;
            }
            const data = await res.json();
            if (data.status === "expired") {
                setView({ kind: "expired" });
            } else if (data.status === "approved" || data.status === "denied" || data.status === "consumed") {
                setView({ kind: "already_used", status: data.status });
            } else if (data.status === "pending") {
                setView({
                    kind: "confirm",
                    id: data.id,
                    clientName: data.clientName,
                    scopes: data.scopes,
                    account: data.account,
                });
            } else {
                setView({ kind: "invalid" });
            }
        } catch {
            setView({ kind: "error", message: "Couldn't reach the server. Try again." });
        }
    }

    useEffect(() => {
        const pre = searchParams.get("user_code");
        if (pre) lookup(pre);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function decide(id: string, action: "approve" | "deny") {
        setSubmitting(true);
        try {
            const res = await fetch("/api/auth/device/verify", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action }),
            });
            if (!res.ok) {
                setView({ kind: "error", message: "Couldn't complete that action. The code may have expired." });
                return;
            }
            setView({ kind: action === "approve" ? "approved" : "denied" });
        } catch {
            setView({ kind: "error", message: "Couldn't reach the server. Try again." });
        } finally {
            setSubmitting(false);
        }
    }

    if (view.kind === "enter_code") {
        return (
            <div className="device-card">
                <h1>Connect a device</h1>
                <p>Enter the code shown in your terminal or app.</p>
                <input
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="WXHF-7NKQ"
                    maxLength={9}
                    autoFocus
                />
                <button
                    disabled={codeInput.trim().length < 8}
                    onClick={() => lookup(codeInput.trim())}
                >
                    Continue
                </button>
            </div>
        );
    }

    if (view.kind === "loading") {
        return <div className="device-card">Checking code…</div>;
    }

    if (view.kind === "requires_login") {
        const next = `/device?user_code=${encodeURIComponent(codeInput)}`;
        return (
            <div className="device-card">
                <h1>Sign in first</h1>
                <p>You need to be signed in to approve a device.</p>
                <button onClick={() => router.push(`/login?next=${encodeURIComponent(next)}`)}>
                    Sign in
                </button>
            </div>
        );
    }

    if (view.kind === "invalid") {
        return (
            <div className="device-card">
                <h1>That code isn't valid</h1>
                <p>Double check what's shown on your device, or start over there.</p>
            </div>
        );
    }

    if (view.kind === "expired") {
        return (
            <div className="device-card">
                <h1>This code has expired</h1>
                <p>Go back to your device and start the sign-in again.</p>
            </div>
        );
    }

    if (view.kind === "already_used") {
        const copy =
            view.status === "approved" || view.status === "consumed"
                ? "This code has already been approved."
                : "This code was already denied.";
        return (
            <div className="device-card">
                <h1>{copy}</h1>
            </div>
        );
    }

    if (view.kind === "confirm") {
        const highImpact = view.scopes.filter((s) => s.highImpact);
        const normal = view.scopes.filter((s) => !s.highImpact);
        return (
            <div className="device-card">
                <div className="device-card-header">
                    <img
                        src={generatePixelAvatar(view.clientName, 44)}
                        alt=""
                        width={44}
                        height={44}
                        style={{ borderRadius: 10 }}
                    />
                    <div>
                        <h1>{view.clientName}</h1>
                        <p>wants to access your account</p>
                    </div>
                </div>

                <div className="device-account">
                    Signed in as <strong>{view.account.displayName || view.account.email}</strong>
                </div>

                <div className="device-scopes">
                    {highImpact.length > 0 && (
                        <div className="device-scopes-highimpact">
                            <strong>Sensitive permissions</strong>
                            <ul>
                                {highImpact.map((s) => (
                                    <li key={s.id}>{s.description}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <ul>
                        {normal.map((s) => (
                            <li key={s.id}>{s.description}</li>
                        ))}
                    </ul>
                </div>

                <div className="device-actions">
                    <button disabled={submitting} onClick={() => decide(view.id, "deny")}>
                        Deny
                    </button>
                    <button
                        disabled={submitting}
                        className="primary"
                        onClick={() => decide(view.id, "approve")}
                    >
                        Approve
                    </button>
                </div>
            </div>
        );
    }

    if (view.kind === "approved") {
        return (
            <div className="device-card">
                <h1>Device connected</h1>
                <p>You can close this tab and return to your terminal or app.</p>
            </div>
        );
    }

    if (view.kind === "denied") {
        return (
            <div className="device-card">
                <h1>Request denied</h1>
                <p>The device was not authorized.</p>
            </div>
        );
    }

    return (
        <div className="device-card">
            <h1>Something went wrong</h1>
            <p>{view.kind === "error" ? view.message : "Please try again."}</p>
        </div>
    );
}

export default function DevicePage() {
    return (
        <Suspense fallback={<div className="device-card">Loading…</div>}>
            <DeviceContent />
        </Suspense>
    );
}
