'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
  center = [21.2514, 81.6296], // Default to Raipur, Chhattisgarh
  zoom = 7
}: LocationLeafletMapProps) {
  const [filteredData, setFilteredData] = useState<LocationData[]>([]);

  // Process data and filter out items without coordinates
  useEffect(() => {
    if (!data || data.length === 0) {
      setFilteredData([]);
      return;
    }

    // Filter out items without coordinates
    const validData = data.filter(item => 
      item.lat !== undefined && item.lng !== undefined &&
      !isNaN(item.lat) && !isNaN(item.lng)
    );

    setFilteredData(validData);
  }, [data]);

  // Create custom icon based on count
  const createCustomIcon = (count: number, maxCount: number) => {
    const intensity = count / maxCount;
    const size = 20 + (intensity * 20); // Size varies from 20 to 40
    const color = `hsl(${200 + intensity * 60}, 70%, 50%)`; // Blue to green gradient

    return L.divIcon({
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${count}
        </div>
      `,
      iconSize: [size, size],
      className: 'custom-marker',
    });
  };

  const maxCount = filteredData.length > 0 ? Math.max(...filteredData.map(d => d.count)) : 1;
  const totalCount = filteredData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">स्थान के अनुसार गतिविधि</h3>
        <p className="text-sm text-gray-600">जिलों और शहरों में पोस्टिंग वितरण - मानचित्र</p>
      </div>

      <div className="space-y-4">
        {/* Map */}
        <div className="border rounded-lg overflow-hidden">
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '400px', width: '100%' }}
            data-testid="map-container"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              data-testid="tile-layer"
            />
            
            {filteredData.map((item, index) => (
              <Marker
                key={index}
                position={[item.lat!, item.lng!]}
                icon={createCustomIcon(item.count, maxCount)}
                data-testid="marker"
              >
                <Popup data-testid="popup">
                  <div className="p-2">
                    <h4 className="font-semibold text-gray-900 mb-2">{item.location}</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>पोस्ट्स: {item.count}</div>
                      <div>प्रतिशत: {item.percentage || Math.round((item.count / totalCount) * 100)}%</div>
                      {item.district && <div>जिला: {item.district}</div>}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">स्थान लेजेंड</h4>
          {filteredData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredData.map((item, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  <div 
                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                    style={{ 
                      backgroundColor: `hsl(${200 + (item.count / maxCount) * 60}, 70%, 50%)` 
                    }}
                  />
                  <span className="text-gray-900">{item.location}</span>
                  <span className="text-gray-600">({item.count})</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              कोई डेटा उपलब्ध नहीं या निर्देशांक गुम हैं
            </div>
          )}
        </div>

        {/* Summary */}
        {filteredData.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>कुल: {totalCount}</span>
              <span>
                सबसे अधिक: {filteredData.reduce((max, item) => 
                  item.count > max.count ? item : max
                ).location}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
