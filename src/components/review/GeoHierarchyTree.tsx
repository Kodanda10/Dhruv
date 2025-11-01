'use client';
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, MapPin, Building, Users, Home } from 'lucide-react';

interface GeoHierarchy {
  village: string;
  gram_panchayat?: string;
  block: string;
  assembly: string;
  district: string;
  is_urban: boolean;
  ulb?: string;
  ward_no?: number;
  confidence: number;
}

interface GeoHierarchyTreeProps {
  locations: string[];
  tweetText: string;
  onHierarchyUpdate?: (hierarchies: GeoHierarchy[]) => void;
}

export default function GeoHierarchyTree({ 
  locations, 
  tweetText, 
  onHierarchyUpdate 
}: GeoHierarchyTreeProps) {
  const [hierarchies, setHierarchies] = useState<GeoHierarchy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Fetch geo-hierarchy data when locations change
  useEffect(() => {
    if (locations.length === 0) {
      setHierarchies([]);
      return;
    }

    const fetchHierarchies = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/geo-extraction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            locations,
            tweetText,
            context: tweetText
          })
        });

        if (!response || !response.ok) {
          throw new Error('Failed to fetch geo-hierarchy data');
        }

        const data = await response.json();
        
        // Combine resolved hierarchies and suggested matches from ambiguous
        const allHierarchies = [
          ...data.hierarchies,
          ...data.ambiguous.map((item: any) => item.suggestedMatch)
        ];

        setHierarchies(allHierarchies);
        onHierarchyUpdate?.(allHierarchies);
      } catch (err) {
        console.error('Error fetching geo-hierarchy:', err);
        setError('स्थान पदानुक्रम लोड करने में त्रुटि');
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchies();
  }, [locations, tweetText, onHierarchyUpdate]);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-900/30';
    if (confidence >= 0.6) return 'bg-yellow-900/30';
    return 'bg-red-900/30';
  };

  if (loading) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-gray-800/50">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-sm">स्थान पदानुक्रम लोड हो रहा है...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-red-900/20 border border-red-800">
        <div className="flex items-center gap-2 text-red-400">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (hierarchies.length === 0) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-gray-800/50">
        <div className="flex items-center gap-2 text-gray-400">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">कोई स्थान पदानुक्रम नहीं मिला</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-gray-300">
        <MapPin className="w-4 h-4" />
        <span className="text-sm font-medium">स्थान पदानुक्रम</span>
      </div>
      
      {hierarchies.map((hierarchy, index) => (
        <div key={index} className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
          {/* Village/ULB Level */}
          <div className="flex items-center gap-2 mb-3">
            <div className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceBg(hierarchy.confidence)} ${getConfidenceColor(hierarchy.confidence)}`}>
              {Math.round(hierarchy.confidence * 100)}% विश्वास
            </div>
            <span className="text-sm text-gray-400">स्थान:</span>
            <span className="font-semibold text-gray-200">{hierarchy.village}</span>
            {hierarchy.is_urban && hierarchy.ulb && (
              <span className="text-xs text-blue-400">({hierarchy.ulb})</span>
            )}
          </div>

          {/* Hierarchy Tree */}
          <div className="space-y-2">
            {/* Gram Panchayat / ULB */}
            {(hierarchy.gram_panchayat || hierarchy.ulb) && (
              <div className="flex items-center gap-2 ml-4">
                <Home className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-400">ग्राम पंचायत/ULB:</span>
                <span className="text-sm text-gray-300">
                  {hierarchy.is_urban ? hierarchy.ulb : hierarchy.gram_panchayat}
                </span>
                {hierarchy.ward_no && (
                  <span className="text-xs text-blue-400">वार्ड {hierarchy.ward_no}</span>
                )}
              </div>
            )}

            {/* Block */}
            <div className="flex items-center gap-2 ml-4">
              <Building className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-400">ब्लॉक:</span>
              <span className="text-sm text-gray-300">{hierarchy.block}</span>
            </div>

            {/* Assembly */}
            <div className="flex items-center gap-2 ml-4">
              <Users className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-400">विधानसभा:</span>
              <span className="text-sm text-gray-300">{hierarchy.assembly}</span>
            </div>

            {/* District */}
            <div className="flex items-center gap-2 ml-4">
              <MapPin className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-400">जिला:</span>
              <span className="text-sm text-gray-300">{hierarchy.district}</span>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>प्रकार: {hierarchy.is_urban ? 'शहरी' : 'ग्रामीण'}</span>
              <span>पदानुक्रम ID: {index + 1}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
