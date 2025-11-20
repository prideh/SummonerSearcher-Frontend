import { useState, useEffect, useRef } from 'react';

const timeUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const getRelativeTime = (timestamp: number | undefined) => {
  if (!timestamp) return '';
  const elapsed = (timestamp - Date.now()) / 1000;

  for (const [unit, secondsInUnit] of timeUnits) {
    if (Math.abs(elapsed) > secondsInUnit || unit === 'second') {
      const value = Math.round(elapsed / secondsInUnit);
      return rtf.format(value, unit);
    }
  }

  return 'just now';
};

export const useTimeAgo = (timestamp: number | undefined): [string, React.RefObject<HTMLDivElement | null>] => {
  const [timeAgo, setTimeAgo] = useState(() => getRelativeTime(timestamp));
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
