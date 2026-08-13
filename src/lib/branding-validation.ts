/**
 * Branding Validation and Sanitization utilities.
 *
 * Implements:
 * 1. Sanitization to strip HTML and script characters.
 * 2. URL verification for homepage, terms, and privacy policy URLs.
 * 3. Color format validation and relative contrast calculations (WCAG AA 4.5:1).
 * 4. Image type and size verification via HEAD/GET requests.
 */

// Hex color validation regex
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Strips any HTML tags from a string to prevent arbitrary scripting or HTML injection.
 */
export function sanitizeString(val: string): string {
    return val.replace(/<[^>]*>/g, "").trim();
}

/**
 * Validates that a string is a well-formed absolute URL.
 * Allows http for localhost, forces https for other hosts.
 */
export function isValidUrl(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
            return false;
        }
        // Force HTTPS for non-localhost
        if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Checks if all redirect URIs share the same base domain or are subdomains of the homepage domain.
 */
export function validateRedirectDomains(homepageUrl: string, redirectUris: string[]): boolean {
    try {
        const homeHost = new URL(homepageUrl).hostname.toLowerCase();
        for (const uri of redirectUris) {
            const redirectHost = new URL(uri).hostname.toLowerCase();
            if (redirectHost !== homeHost && !redirectHost.endsWith("." + homeHost)) {
                return false;
            }
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Converts a hex color to decimal RGB components.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    if (!HEX_COLOR_REGEX.test(hex)) return null;

    let cleanHex = hex.slice(1);
    if (cleanHex.length === 3 || cleanHex.length === 4) {
        // Expand shorthand format (e.g. "03F" to "0033FF")
        cleanHex = cleanHex
            .split("")
            .map((char) => char + char)
            .join("");
    }

    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);

    return { r, g, b };
}

/**
 * Computes relative luminance of an RGB color.
 * Formula defined by WCAG 2.0.
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Computes contrast ratio between two relative luminances.
 * Returns value between 1 and 21.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    if (!rgb1 || !rgb2) return 1;

    const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Determines contrast color (either white `#FFFFFF` or black `#000000`)
 * that has the best contrast against the given background hex color.
 */
export function getContrastColor(bgHex: string): string {
    const contrastWithWhite = getContrastRatio(bgHex, "#FFFFFF");
    const contrastWithBlack = getContrastRatio(bgHex, "#000000");
    return contrastWithWhite >= contrastWithBlack ? "#FFFFFF" : "#000000";
}

/**
 * Validates that a color has a contrast ratio >= 4.5:1 against either white or black.
 */
export function hasSufficientContrast(hex: string): boolean {
    if (!HEX_COLOR_REGEX.test(hex)) return false;
    const ratioWhite = getContrastRatio(hex, "#FFFFFF");
    const ratioBlack = getContrastRatio(hex, "#000000");
    return ratioWhite >= 4.5 || ratioBlack >= 4.5;
}

/**
 * Fetches HEAD/GET headers of a logo URL to validate that:
 * 1. It is accessible (2xx response).
 * 2. It has an image Content-Type.
 * 3. Its Content-Length does not exceed 1MB.
 */
export async function validateLogoUrl(url: string): Promise<{ valid: boolean; error?: string }> {
    if (!isValidUrl(url)) {
        return { valid: false, error: "Invalid URL format" };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        let res: Response | null = null;
        try {
            res = await fetch(url, {
                method: "HEAD",
                signal: controller.signal,
            });
        } catch {
            // HEAD might be rejected or fail, retry with GET
        }

        if (!res || !res.ok) {
            try {
                res = await fetch(url, {
                    method: "GET",
                    signal: controller.signal,
                });
            } catch {
                // Ignore and handle below
            }
        }

        clearTimeout(timeoutId);

        if (!res || !res.ok) {
            return { valid: false, error: "Logo URL is unreachable or returned an error status" };
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.toLowerCase().startsWith("image/")) {
            return { valid: false, error: `Invalid content type: ${contentType}. Must be an image.` };
        }

        const contentLengthStr = res.headers.get("content-length");
        if (contentLengthStr) {
            const contentLength = parseInt(contentLengthStr, 10);
            if (contentLength > 1048576) {
                return { valid: false, error: "Logo image size exceeds 1MB limit" };
            }
        }

        return { valid: true };
    } catch (err) {
        return { valid: false, error: "Network error fetching logo" };
    }
}
