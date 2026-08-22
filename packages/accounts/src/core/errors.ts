/**
 * Base error for all @elixpo/accounts errors.
 * Never include raw tokens, secrets, or full request/response bodies in messages.
 */
export class AccountsError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = "AccountsError";
        this.code = code;
    }
}

export class DiscoveryError extends AccountsError {
    constructor(message: string) {
        super("discovery_failed", message);
        this.name = "DiscoveryError";
    }
}

export class ConfigError extends AccountsError {
    constructor(message: string) {
        super("invalid_config", message);
        this.name = "ConfigError";
    }
}
