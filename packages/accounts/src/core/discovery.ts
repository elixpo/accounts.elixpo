import { ConfigError, DiscoveryError } from "./errors";
import {
    type AccountsConfig,
    isOIDCConfiguration,
    type OIDCConfiguration,
} from "./types";

const discoveryCache = new Map<string, Promise<OIDCConfiguration>>();

function wellKnownUrl(issuer: string): string {
    return `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
}

/**
 * Fetches and validates the OIDC discovery document for the configured issuer.
 * Results are cached in-memory per issuer for the lifetime of the process/request.
 */
export async function discover(
    config: AccountsConfig,
): Promise<OIDCConfiguration> {
    if (!config.issuer) {
        throw new ConfigError("AccountsConfig.issuer is required");
    }
    if (!config.clientId) {
        throw new ConfigError("AccountsConfig.clientId is required");
    }

    const cached = discoveryCache.get(config.issuer);
    if (cached) return cached;

    const promise = fetchDiscovery(config.issuer);
    discoveryCache.set(config.issuer, promise);

    try {
        return await promise;
    } catch (err) {
        discoveryCache.delete(config.issuer);
        throw err;
    }
}

async function fetchDiscovery(issuer: string): Promise<OIDCConfiguration> {
    const url = wellKnownUrl(issuer);
    let response: Response;

    try {
        response = await fetch(url, {
            headers: { accept: "application/json" },
        });
    } catch {
        throw new DiscoveryError(
            `Failed to reach discovery endpoint at ${url}`,
        );
    }

    if (!response.ok) {
        throw new DiscoveryError(
            `Discovery endpoint returned ${response.status} for ${url}`,
        );
    }

    let body: unknown;
    try {
        body = await response.json();
    } catch {
        throw new DiscoveryError(
            `Discovery response from ${url} was not valid JSON`,
        );
    }

    if (!isOIDCConfiguration(body)) {
        throw new DiscoveryError(
            `Discovery response from ${url} is missing required OIDC fields`,
        );
    }

    if (body.issuer !== issuer) {
        throw new DiscoveryError(
            `Discovery document issuer "${body.issuer}" does not match configured issuer "${issuer}"`,
        );
    }

    return body;
}

/** Clears the in-memory discovery cache. Exposed for tests. */
export function clearDiscoveryCache(): void {
    discoveryCache.clear();
}
