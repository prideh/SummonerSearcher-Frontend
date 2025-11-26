import { describe, it, expect } from 'vitest';
import { toApiRegion, toUrlRegion } from './regionUtils';

describe('regionUtils', () => {
  describe('toApiRegion', () => {
    it('maps "eu" to "EUW1"', () => {
      expect(toApiRegion('eu')).toBe('EUW1');
    });

    it('maps "na" to "NA1"', () => {
      expect(toApiRegion('na')).toBe('NA1');
    });

    it('maps "kr" to "KR"', () => {
      expect(toApiRegion('kr')).toBe('KR');
    });

    // This is the failing case reported by the user
    it('maps "na1" to "NA1"', () => {
      expect(toApiRegion('na1')).toBe('NA1');
    });

    it('maps "euw1" to "EUW1"', () => {
      expect(toApiRegion('euw1')).toBe('EUW1');
    });

    it('maps "EUW1" (case insensitive) to "EUW1"', () => {
      expect(toApiRegion('EUW1')).toBe('EUW1');
    });

    it('defaults to "EUW1" for unknown regions', () => {
      expect(toApiRegion('unknown')).toBe('EUW1');
    });
    
    it('defaults to "EUW1" for null', () => {
        expect(toApiRegion(null)).toBe('EUW1');
      });
  });

  describe('toUrlRegion', () => {
    it('maps "EUW1" to "eu"', () => {
      expect(toUrlRegion('EUW1')).toBe('eu');
    });

    it('maps "NA1" to "na"', () => {
      expect(toUrlRegion('NA1')).toBe('na');
    });

    it('maps "KR" to "kr"', () => {
      expect(toUrlRegion('KR')).toBe('kr');
    });

    it('defaults to lowercase input if no mapping found', () => {
      expect(toUrlRegion('UNKNOWN')).toBe('unknown');
    });
  });
});
