import { useState, useEffect, useRef } from 'react';

/**
 * Defines the time units and their duration in seconds for calculating relative time.
 */
const timeUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/** An instance of Intl.RelativeTimeFormat for formatting time differences into human-readable strings (e.g., "2 hours ago"). */
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * Calculates the relative time string between a given timestamp and now.
 * @param timestamp - The Unix timestamp (in milliseconds) to compare against.
 * @returns A formatted relative time string (e.g., "5 minutes ago").
 */
const getRelativeTime = (timestamp: number | undefined) => {
  if (!timestamp) return '';
  const elapsed = (timestamp - Date.now()) / 1000;

  for (const [unit, secondsInUnit] of timeUnits) {
    if (Math.abs(elapsed) >= secondsInUnit || unit === 'second') {
      const value = Math.round(elapsed / secondsInUnit);
      return rtf.format(value, unit);
    }
  }

  return 'just now';
};

/**
 * A custom hook that provides a dynamically updating "time ago" string for a given timestamp.
 * It uses the Intersection Observer API to only update the time when the component is visible on screen,
 * which is a performance optimization.
 * @param timestamp - The Unix timestamp (in milliseconds).
 * @returns A tuple containing the formatted time string and a ref object to attach to the target element.
 */
export const useTimeAgo = (timestamp: number | undefined): [string, React.RefObject<HTMLDivElement | null>] => {
  const [timeAgo, setTimeAgo] = useState(() => getRelativeTime(timestamp));
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Effect to set up the Intersection Observer to track the visibility of the element.
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin: '0px',
        threshold: 0.1,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  // Effect to immediately update when timestamp changes (e.g., after a refresh)
  useEffect(() => {
    setTimeAgo(getRelativeTime(timestamp));
  }, [timestamp]);

  // Effect to set up an interval that updates the time string, but only when the element is visible.
  useEffect(() => {
    let interval: number | undefined;

    if (isVisible) {
      interval = window.setInterval(() => {
        setTimeAgo(getRelativeTime(timestamp));
      }, 30000); // Update every 30 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timestamp, isVisible]);

  return [timeAgo, ref];
};
