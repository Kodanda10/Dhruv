'use client';

import { useMemo } from 'react';
import Card from '../ui/Card';
import { formatConfidence } from '@/lib/colors';

interface ParsedTweet {
  id: string;
  confidence?: number;
  review_status?: string;
}

interface ProgressSidebarProps {
  tweets: ParsedTweet[];
  currentIndex: number;
  onFilterByStatus?: (status: string) => void;
  onJumpToTweet?: (index: number) => void;
}

export default function ProgressSidebar({ 
  tweets, 
  currentIndex, 
  onFilterByStatus, 
  onJumpToTweet 
}: ProgressSidebarProps) {
  const stats = useMemo(() => {
    const total = tweets.length;
    const pending = tweets.filter(t => !t.review_status || t.review_status === 'pending').length;
    const approved = tweets.filter(t => t.review_status === 'approved').length;
    const edited = tweets.filter(t => t.review_status === 'corrected' || t.review_status === 'edited').length;
    const skipped = tweets.filter(t => t.review_status === 'skipped').length;
    const rejected = tweets.filter(t => t.review_status === 'rejected').length;
    
    const reviewed = approved + edited;
    const avgConfidence = tweets.reduce((sum, t) => sum + (t.confidence || 0), 0) / total;
    const progressPercentage = total > 0 ? ((reviewed + skipped) / total) * 100 : 0;
    
    return {
      total,
      pending,
      approved,
      edited,
      skipped,
      rejected,
      reviewed,
      avgConfidence,
      progressPercentage,
    };
  }, [tweets]);

  const handleStatusClick = (status: string) => {
    if (onFilterByStatus) {
      onFilterByStatus(status);
    }
  };

  const handleStatClick = (statType: string) => {
    if (onJumpToTweet) {
      switch (statType) {
        case 'pending':
          const firstPending = tweets.findIndex(t => !t.review_status || t.review_status === 'pending');
          if (firstPending >= 0) onJumpToTweet(firstPending);
          break;
        case 'low-confidence':
          const firstLowConfidence = tweets.findIndex(t => (t.confidence || 0) <= 0.5);
          if (firstLowConfidence >= 0) onJumpToTweet(firstLowConfidence);
          break;
        case 'approved':
          const firstApproved = tweets.findIndex(t => t.review_status === 'approved');
          if (firstApproved >= 0) onJumpToTweet(firstApproved);
          break;
      }
    }
  };

  return (
    <div className="w-64 bg-white border-l border-gray-200 p-4 space-y-4 sticky top-0 h-screen overflow-y-auto">
      {/* Progress Bar */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">समीक्षा प्रगति</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Progress</span>
            <span>{Math.round(stats.progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${stats.progressPercentage}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">आंकड़े</h3>
        <div className="space-y-3">
          <div 
            className="flex justify-between items-center p-2 rounded hover:bg-gray-50 cursor-pointer"
            onClick={() => handleStatClick('pending')}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Pending</span>
            </div>
            <span className="text-sm font-semibold text-amber-600">{stats.pending}</span>
          </div>
          
          <div 
            className="flex justify-between items-center p-2 rounded hover:bg-gray-50 cursor-pointer"
            onClick={() => handleStatClick('approved')}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Approved</span>
            </div>
            <span className="text-sm font-semibold text-green-600">{stats.approved}</span>
          </div>
          
          <div className="flex justify-between items-center p-2 rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Edited</span>
            </div>
            <span className="text-sm font-semibold text-blue-600">{stats.edited}</span>
          </div>
          
          <div className="flex justify-between items-center p-2 rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Skipped</span>
            </div>
            <span className="text-sm font-semibold text-gray-600">{stats.skipped}</span>
          </div>
          
          {stats.rejected > 0 && (
            <div className="flex justify-between items-center p-2 rounded">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Rejected</span>
              </div>
              <span className="text-sm font-semibold text-red-600">{stats.rejected}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Confidence Score */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">औसत विश्वास</h3>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {formatConfidence(stats.avgConfidence)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Average Confidence
          </div>
        </div>
      </Card>

      {/* Low Confidence Alert */}
      {stats.pending > 0 && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <h3 className="text-sm font-semibold text-red-900">Low Confidence</h3>
          </div>
          <div 
            className="text-sm text-red-700 cursor-pointer hover:text-red-800"
            onClick={() => handleStatClick('low-confidence')}
          >
            {tweets.filter(t => (t.confidence || 0) <= 0.5).length} tweets need attention
          </div>
        </Card>
      )}

      {/* Current Position */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Current Position</h3>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">
            {currentIndex + 1} / {stats.total}
          </div>
          <div className="text-xs text-gray-500">
            Tweet Position
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <button 
            className="w-full text-left text-sm text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50"
            onClick={() => handleStatusClick('pending')}
          >
            📝 Show Pending Only
          </button>
          <button 
            className="w-full text-left text-sm text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50"
            onClick={() => handleStatusClick('approved')}
          >
            ✅ Show Approved Only
          </button>
          <button 
            className="w-full text-left text-sm text-amber-600 hover:text-amber-800 p-2 rounded hover:bg-amber-50"
            onClick={() => handleStatClick('low-confidence')}
          >
            ⚠️ Show Low Confidence
          </button>
        </div>
      </Card>
    </div>
  );
}
