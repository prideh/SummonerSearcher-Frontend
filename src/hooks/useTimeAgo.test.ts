import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTimeAgo } from './useTimeAgo';

describe('useTimeAgo', () => {
  beforeEach(() => {
    // Mock IntersectionObserver
    window.IntersectionObserver = class IntersectionObserver {
      readonly root: Element | null = null;
      readonly rootMargin: string = '';
      readonly thresholds: ReadonlyArray<number> = [];
      
      constructor() {}
      
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    } as any;
    
    // Mock Date.now to have consistent time
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string if timestamp is undefined', () => {
    const { result } = renderHook(() => useTimeAgo(undefined));
    expect(result.current[0]).toBe('');
  });

  it('returns "just now" for very recent times', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const { result } = renderHook(() => useTimeAgo(now - 1000)); // 1 second ago
    expect(result.current[0]).toBe('1 second ago');
  });

  it('returns correct relative time for minutes', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const { result } = renderHook(() => useTimeAgo(now - 60 * 1000 * 5)); // 5 minutes ago
    expect(result.current[0]).toBe('5 minutes ago');
  });

  it('returns correct relative time for hours', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const { result } = renderHook(() => useTimeAgo(now - 60 * 60 * 1000 * 2)); // 2 hours ago
    expect(result.current[0]).toBe('2 hours ago');
  });
  
  it('updates when timestamp changes', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const { result, rerender } = renderHook(({ time }) => useTimeAgo(time), {
        initialProps: { time: now - 61 * 1000 }, // 1 minute ago
      });
      
      expect(result.current[0]).toBe('1 minute ago');
      
      // Change prop
      rerender({ time: now - 60 * 60 * 1000 }); // 1 hour ago
      expect(result.current[0]).toBe('1 hour ago');
  });
});
