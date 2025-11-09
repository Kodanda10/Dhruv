'use client';

import React from 'react';

// Temporarily disabled - react-leaflet not installed
// This component requires react-leaflet and leaflet dependencies
// To enable: npm install react-leaflet leaflet @types/leaflet

interface LocationData {
  location: string;
  count: number;
  percentage?: number;
  lat?: number;
  lng?: number;
  district?: string;
  state?: string;
}

interface LocationLeafletMapProps {
  data: LocationData[];
  className?: string;
  center?: [number, number];
  zoom?: number;
}

export default function LocationLeafletMap({
  data,
  className = '',
}: LocationLeafletMapProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">स्थान के अनुसार गतिविधि</h3>
        <p className="text-sm text-gray-600">जिलों और शहरों में पोस्टिंग वितरण - मानचित्र</p>
      </div>
      <div className="text-center text-gray-500 py-8">
        <p>मानचित्र सुविधा जल्द ही उपलब्ध होगी</p>
        <p className="text-sm mt-2">Map feature coming soon</p>
      </div>
    </div>
  );
}
