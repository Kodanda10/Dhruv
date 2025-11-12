import { useEffect } from 'react';
import { redis } from '@/lib/redis';
import { mutate } from 'swr';

const HOME_KEY = "/api/home?tag=home:list";
const ANALYTICS_KEY = "/api/analytics/summary?tag=analytics:summary";

export function useLiveInvalidate() {
  useEffect(() => {
    const channel = redis.subscribe("events:review-updated");

    channel.on("message", (message: any) => {
      const data = JSON.parse(message);
      if (data.include_in_analytics) {
        mutate(HOME_KEY);
        mutate(ANALYTICS_KEY);
        // Add other keys for map and mindmap
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, []);
}
