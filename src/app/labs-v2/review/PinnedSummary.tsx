'use client';

import React from 'react';

interface PinnedSummaryProps {
  location: string;
  eventType: string;
  peopleCount: number;
  schemesCount: number;
}

export default function PinnedSummary({
  location,
  eventType,
  peopleCount,
  schemesCount,
}: PinnedSummaryProps) {
  return (
    <div className="sticky top-4 bg-white p-4 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-lg font-bold mb-3 border-b pb-2">Pinned Summary</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="font-semibold text-gray-600">Location:</span>
          <span className="text-gray-800 truncate" title={location}>{location}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-600">Event Type:</span>
          <span className="text-gray-800 truncate" title={eventType}>{eventType}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-600">People:</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">{peopleCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-600">Schemes:</span>
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">{schemesCount}</span>
        </div>
      </div>
    </div>
  );
}
