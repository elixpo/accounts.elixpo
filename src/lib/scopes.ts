/**
 * Least-privilege scope registry (issue #73).
 *
 * Every scope a device/CLI client can request must be listed here. The
 * device authorization endpoint and the consent/verification screen both
 * read from this table so there is exactly one place that defines what a
 * scope means and how "loud" its consent warning should be.
 */

export interface ScopeDefinition {
    id: string;
    label: string;
    description: string;
    /** Shown with a distinct warning treatment on the verification screen. */
    highImpact: boolean;
}

export const SCOPE_REGISTRY: Record<string, ScopeDefinition> = {
    "profile:read": {
        id: "profile:read",
        label: "Read profile",
        description: "View your name, handle, and public profile info",
        highImpact: false,
    },
    "profile:write": {
        id: "profile:write",
        label: "Edit profile",
        description: "Update your name, bio, and profile settings",
        highImpact: false,
    },
    "blog:read": {
        id: "blog:read",
        label: "Read blogs",
        description: "View your drafts and published posts",
        highImpact: false,
    },
    "blog:write": {
        id: "blog:write",
        label: "Write blogs",
        description: "Create and edit drafts on your behalf",
        highImpact: false,
    },
    "blog:publish": {
        id: "blog:publish",
        label: "Publish blogs",
        description: "Publish posts publicly under your account",
        highImpact: true,
    },
    "blog:delete": {
        id: "blog:delete",
        label: "Delete blogs",
        description: "Permanently delete posts",
        highImpact: true,
    },
    "media:read": {
        id: "media:read",
        label: "Read media",
        description: "View images and files you've uploaded",
        highImpact: false,
    },
    "media:write": {
        id: "media:write",
        label: "Upload media",
        description: "Upload and manage images and files",
        highImpact: false,
    },
    "org:read": {
        id: "org:read",
        label: "Read organizations",
        description: "View organizations you belong to",
        highImpact: false,
    },
    "org:write": {
        id: "org:write",
        label: "Manage organizations",
        description: "Change organization settings and membership",
        highImpact: false,
    },
    "collab:read": {
        id: "collab:read",
        label: "Read collaboration",
        description: "View co-author invites and collaborators",
        highImpact: false,
    },
    "collab:write": {
        id: "collab:write",
        label: "Manage collaboration",
        description: "Invite or remove co-authors",
        highImpact: false,
    },
    "analytics:read": {
        id: "analytics:read",
        label: "Read analytics",
        description: "View post and account statistics",
        highImpact: false,
    },
    "notifications:read": {
        id: "notifications:read",
        label: "Read notifications",
        description: "View your notifications",
        highImpact: false,
    },
    "account:delete": {
        id: "account:delete",
        label: "Delete account",
        description: "Permanently delete your Elixpo account",
        highImpact: true,
    },
};

export function describeScopes(scopeString: string): ScopeDefinition[] {
    return scopeString
        .split(" ")
        .filter(Boolean)
        .map(
            (s) =>
                SCOPE_REGISTRY[s] || {
                    id: s,
                    label: s,
                    description: "Unknown scope",
                    highImpact: true, // fail closed: unknown = treat as high-impact
                },
        );
}

/** Validate a requested scope string against a client's allowed scopes. */
export function validateRequestedScopes(
    requested: string,
    clientAllowedScopes: string[],
): { valid: boolean; invalid: string[] } {
    const requestedList = requested.split(" ").filter(Boolean);
    const invalid = requestedList.filter(
        (s) => !clientAllowedScopes.includes(s) || !SCOPE_REGISTRY[s],
    );
    return { valid: invalid.length === 0, invalid };
}
