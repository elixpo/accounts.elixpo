import { describe, it, expect } from 'vitest';
import { isRequestedAudienceAllowed } from '../device-auth-service';

describe('isRequestedAudienceAllowed', () => {
    it('allows when no audience is requested', () => {
        expect(isRequestedAudienceAllowed(null, 'api.example.com')).toBe(true);
        expect(isRequestedAudienceAllowed(undefined, undefined)).toBe(true);
    });

    it('denies when audience is requested but client has none approved', () => {
        expect(isRequestedAudienceAllowed('api.example.com', null)).toBe(false);
    });

    it('allows when requested audience exactly matches approved audience', () => {
        expect(isRequestedAudienceAllowed('api.example.com', 'api.example.com')).toBe(true);
    });

    it('denies when requested audience mismatches approved audience', () => {
        expect(isRequestedAudienceAllowed('api.example.com', 'other.example.com')).toBe(false);
    });
});
