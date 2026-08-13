import { describe, expect, it } from "vitest";
import {
    sanitizeString,
    isValidUrl,
    validateRedirectDomains,
    hexToRgb,
    getContrastRatio,
    hasSufficientContrast,
    getContrastColor,
} from "../branding-validation";

describe("Branding Validation and Sanitization", () => {
    describe("sanitizeString", () => {
        it("should strip HTML and script tags", () => {
            expect(sanitizeString("My <b>App</b>")).toBe("My App");
            expect(sanitizeString("<script>alert(1)</script>Safe App")).toBe("alert(1)Safe App");
        });

        it("should trim whitespace", () => {
            expect(sanitizeString("   Cool App   ")).toBe("Cool App");
        });
    });

    describe("isValidUrl", () => {
        it("should validate standard https URLs", () => {
            expect(isValidUrl("https://example.com")).toBe(true);
            expect(isValidUrl("https://sub.domain.co.uk/path?query=1")).toBe(true);
        });

        it("should allow http for localhost and 127.0.0.1", () => {
            expect(isValidUrl("http://localhost:3000/callback")).toBe(true);
            expect(isValidUrl("http://127.0.0.1/abc")).toBe(true);
        });

        it("should reject http for non-localhost", () => {
            expect(isValidUrl("http://example.com")).toBe(false);
            expect(isValidUrl("http://sub.domain.co.uk")).toBe(false);
        });

        it("should reject invalid URL strings", () => {
            expect(isValidUrl("not-a-url")).toBe(false);
            expect(isValidUrl("ftp://example.com")).toBe(false);
        });
    });

    describe("validateRedirectDomains", () => {
        it("should allow redirect URIs matching base domain or subdomains", () => {
            expect(
                validateRedirectDomains("https://example.com", [
                    "https://example.com/callback",
                    "https://sub.example.com/auth",
                ])
            ).toBe(true);
        });

        it("should reject redirect URIs matching separate domains", () => {
            expect(
                validateRedirectDomains("https://example.com", [
                    "https://example.com/callback",
                    "https://anotherdomain.com/auth",
                ])
            ).toBe(false);
        });
    });

    describe("hexToRgb", () => {
        it("should convert hex colors to decimal RGB", () => {
            expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
            expect(hexToRgb("#ff7759")).toEqual({ r: 255, g: 119, b: 89 });
            expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
        });

        it("should handle shorthand hex codes", () => {
            expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
            expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
        });

        it("should return null for invalid hex format", () => {
            expect(hexToRgb("red")).toBeNull();
            expect(hexToRgb("#12345")).toBeNull();
        });
    });

    describe("getContrastRatio", () => {
        it("should return correct ratio between two colors", () => {
            expect(getContrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 1);
            expect(getContrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
            expect(getContrastRatio("#ff7759", "#ffffff")).toBeCloseTo(2.6, 1);
        });
    });

    describe("hasSufficientContrast", () => {
        it("should return true for valid colors", () => {
            expect(hasSufficientContrast("#ff7759")).toBe(true); // ~2.6 vs white, ~6.7 vs black (ratio >= 4.5)
            expect(hasSufficientContrast("#000000")).toBe(true); // 21 vs white
            expect(hasSufficientContrast("#ffffff")).toBe(true); // 21 vs black
        });

        it("should return false for invalid hex colors", () => {
            expect(hasSufficientContrast("invalid")).toBe(false);
        });
    });

    describe("getContrastColor", () => {
        it("should return best contrast text color", () => {
            expect(getContrastColor("#ffffff")).toBe("#000000"); // White background needs black text
            expect(getContrastColor("#000000")).toBe("#FFFFFF"); // Black background needs white text
            expect(getContrastColor("#ff7759")).toBe("#000000"); // Light orange background needs black text
        });
    });
});
