'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface EventLocation {
  lat: number;
  lng: number;
  name: string;
}

export default function MapboxCard() {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [locations, setLocations] = useState<EventLocation[]>([]);
  const mapContainer = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/analytics/locations');
        const data = await response.json();
        if (data.success) {
          setLocations(data.locations);
        }
      } catch (error) {
        console.error('Failed to fetch locations:', error);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    if (map || !mapContainer.current || !mapboxgl.accessToken) return;

    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [83.38, 22.17], // Raigarh approx.
      zoom: 7,
    });

    newMap.on('load', () => {
      setMap(newMap);
    });

    return () => newMap.remove();
  }, []);

  useEffect(() => {
    if (!map || !locations.length) return;

    locations.forEach(location => {
      if (location.lat && location.lng) {
        new mapboxgl.Marker()
          .setLngLat([location.lng, location.lat])
          .setPopup(new mapboxgl.Popup().setText(location.name))
          .addTo(map);
      }
    });
  }, [map, locations]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="glassmorphic-card rounded-lg p-6"
    >
      <h3 className="text-xl font-bold mb-4 text-white">Event Location Map</h3>
      <div ref={mapContainer} className="w-full h-96 rounded-lg" />
    </motion.div>
  );
}
