'use client';
import React, { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight, MapPin, Building, Users, Home, AlertCircle } from 'lucide-react';
import { GeoHierarchy } from '@/lib/geo-extraction/hierarchy-resolver';

export interface GeoHierarchyEditorProps {
  locationName: string;
  currentHierarchy: GeoHierarchy | null;
  candidates: GeoHierarchy[];
  needs_review: boolean;
  explanations: string[];
  onConfirm: (hierarchy: GeoHierarchy) => void;
  onReject: () => void;
}

export default function GeoHierarchyEditor({
  locationName,
  currentHierarchy,
  candidates,
  needs_review,
  explanations,
  onConfirm,
  onReject
}: GeoHierarchyEditorProps) {
  const [expandedCandidates, setExpandedCandidates] = useState<Set<number>>(new Set());
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  const toggleCandidate = (index: number) => {
    const newExpanded = new Set(expandedCandidates);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCandidates(newExpanded);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.98) return 'text-green-400 bg-green-900/30 border-green-700';
    if (confidence >= 0.85) return 'text-yellow-400 bg-yellow-900/30 border-yellow-700';
    return 'text-red-400 bg-red-900/30 border-red-700';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.98) return 'Exact Match';
    if (confidence >= 0.85) return 'High Confidence';
    return 'Low Confidence';
  };

  const formatHierarchyPath = (hierarchy: GeoHierarchy): string => {
    const parts: string[] = [hierarchy.district, hierarchy.assembly, hierarchy.block];
    if (hierarchy.is_urban && hierarchy.ulb) {
      parts.push(hierarchy.ulb);
      if (hierarchy.ward_no) {
        parts.push(`Ward ${hierarchy.ward_no}`);
      }
    } else if (hierarchy.gram_panchayat) {
      parts.push(hierarchy.gram_panchayat);
    }
    parts.push(hierarchy.village);
    return parts.join(' → ');
  };

  const handleConfirm = (candidate: GeoHierarchy, index: number) => {
    // Set confidence to 1.0 as per plan requirement
    const confirmedHierarchy: GeoHierarchy = {
      ...candidate,
      confidence: 1.0
    };
    setSelectedCandidateId(index);
    onConfirm(confirmedHierarchy);
  };

  // If no candidates, show error state
  if (candidates.length === 0) {
    return (
      <div className="mb-4 p-4 rounded-lg bg-red-900/20 border border-red-800">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">No matches found</span>
        </div>
        <p className="mt-2 text-xs text-red-300">
          No geographic matches found for location: &quot;{locationName}&quot;
        </p>
        <button
          onClick={onReject}
          className="mt-3 px-3 py-1.5 text-xs rounded-md bg-red-800 hover:bg-red-700 text-white"
        >
          Reject Location
        </button>
      </div>
    );
  }

  // Single candidate with high confidence - auto-suggest
  const highestConfidenceCandidate = candidates.reduce((best, current) => 
    (current.confidence > (best?.confidence ?? 0)) ? current : best
  , candidates[0]);

  return (
    <div className="mb-4 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-200">
              Location Review: {locationName}
            </span>
            {needs_review && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-700">
                Needs Review
              </span>
            )}
          </div>
          
          {/* Explanations */}
          {explanations.length > 0 && (
            <div className="mt-2 space-y-1">
              {explanations.map((explanation, idx) => (
                <p key={idx} className="text-xs text-gray-400">{explanation}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Candidate Display */}
      <div className="space-y-3">
        {candidates.map((candidate, index) => {
          const isExpanded = expandedCandidates.has(index);
          const isSelected = selectedCandidateId === index;
          const confidenceColor = getConfidenceColor(candidate.confidence);
          const isHighestConfidence = candidate === highestConfidenceCandidate && candidates.length > 1;

          return (
            <div
              key={index}
              className={`rounded-lg border p-3 transition-colors ${
                isSelected 
                  ? 'border-green-600 bg-green-900/20' 
                  : isHighestConfidence
                  ? 'border-blue-600 bg-blue-900/20'
                  : 'border-gray-700 bg-gray-800/30'
              }`}
            >
              {/* Candidate Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => toggleCandidate(index)}
                      className="text-gray-400 hover:text-gray-300 transition-colors"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-sm font-semibold text-gray-200">
                      {candidate.village}
                    </span>
                    {isHighestConfidence && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-900/30 text-blue-400 border border-blue-700">
                        Suggested
                      </span>
                    )}
                    <div className={`px-2 py-0.5 rounded text-xs border ${confidenceColor}`}>
                      {Math.round(candidate.confidence * 100)}% — {getConfidenceLabel(candidate.confidence)}
                    </div>
                  </div>

                  {/* Compact Path View (when collapsed) */}
                  {!isExpanded && (
                    <p className="text-xs text-gray-400 ml-6 truncate">
                      {formatHierarchyPath(candidate)}
                    </p>
                  )}
                </div>

                {/* Confirm Button */}
                <button
                  onClick={() => handleConfirm(candidate, index)}
                  disabled={isSelected}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1 ${
                    isSelected
                      ? 'bg-green-700 text-green-100 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}
                >
                  <Check className="w-3 h-3" />
                  {isSelected ? 'Confirmed' : 'Confirm'}
                </button>
              </div>

              {/* Expanded Hierarchy Tree */}
              {isExpanded && (
                <div className="mt-3 ml-6 space-y-2 pt-3 border-t border-gray-700">
                  {/* Village/ULB Level */}
                  <div className="flex items-center gap-2">
                    <Home className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-400 w-20">स्थान:</span>
                    <span className="text-sm text-gray-200 font-medium">{candidate.village}</span>
                    {candidate.is_urban && candidate.ulb && (
                      <span className="text-xs text-blue-400">({candidate.ulb})</span>
                    )}
                    {candidate.ward_no && (
                      <span className="text-xs text-blue-400">वार्ड {candidate.ward_no}</span>
                    )}
                  </div>

                  {/* Gram Panchayat / ULB */}
                  {(candidate.gram_panchayat || candidate.ulb) && (
                    <div className="flex items-center gap-2">
                      <Home className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-400 w-20">GP/ULB:</span>
                      <span className="text-sm text-gray-300">
                        {candidate.is_urban ? candidate.ulb : candidate.gram_panchayat}
                      </span>
                    </div>
                  )}

                  {/* Block */}
                  <div className="flex items-center gap-2">
                    <Building className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-400 w-20">ब्लॉक:</span>
                    <span className="text-sm text-gray-300">{candidate.block}</span>
                  </div>

                  {/* Assembly */}
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-400 w-20">विधानसभा:</span>
                    <span className="text-sm text-gray-300">{candidate.assembly}</span>
                  </div>

                  {/* District */}
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-400 w-20">जिला:</span>
                    <span className="text-sm text-gray-300">{candidate.district}</span>
                  </div>

                  {/* Type Indicator */}
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <span className="text-xs text-gray-500">
                      Type: {candidate.is_urban ? 'शहरी (Urban)' : 'ग्रामीण (Rural)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between">
        <button
          onClick={onReject}
          className="px-3 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-500 text-white flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Reject All
        </button>
        <div className="text-xs text-gray-400">
          {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Current Hierarchy (if exists) */}
      {currentHierarchy && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">Current hierarchy:</span>
          </div>
          <p className="text-xs text-gray-300 ml-2">{formatHierarchyPath(currentHierarchy)}</p>
        </div>
      )}
    </div>
  );
}


