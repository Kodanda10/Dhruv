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
    <div className="w-64 glass-section-card border-l border-white/10 p-4 space-y-4 sticky top-0 h-screen overflow-y-auto">
      {/* Progress Bar */}
      <div className="glass-section-card p-4">
        <h3 className="text-lg font-bold text-white mb-3 drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]">समीक्षा प्रगति</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-secondary">
            <span>Progress</span>
            <span className="text-white font-semibold">{Math.round(stats.progressPercentage)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-[#8BF5E6] to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${stats.progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="glass-section-card p-4">
        <h3 className="text-lg font-bold text-white mb-3 drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]">आंकड़े</h3>
        <div className="space-y-3">
          <div 
            className="flex justify-between items-center p-2 rounded hover:bg-white/10 cursor-pointer transition-colors"
            onClick={() => handleStatClick('pending')}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
              <span className="text-sm text-white">Pending</span>
            </div>
            <span className="text-sm font-semibold text-amber-400">{stats.pending}</span>
          </div>
          
          <div 
            className="flex justify-between items-center p-2 rounded hover:bg-white/10 cursor-pointer transition-colors"
            onClick={() => handleStatClick('approved')}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-white">Approved</span>
            </div>
            <span className="text-sm font-semibold text-green-400">{stats.approved}</span>
          </div>
          
          <div className="flex justify-between items-center p-2 rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-white">Edited</span>
            </div>
            <span className="text-sm font-semibold text-blue-400">{stats.edited}</span>
          </div>
          
          <div className="flex justify-between items-center p-2 rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-sm text-white">Skipped</span>
            </div>
            <span className="text-sm font-semibold text-gray-400">{stats.skipped}</span>
          </div>
          
          {stats.rejected > 0 && (
            <div className="flex justify-between items-center p-2 rounded">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-white">Rejected</span>
              </div>
              <span className="text-sm font-semibold text-red-400">{stats.rejected}</span>
            </div>
          )}
        </div>
      </div>

      {/* Confidence Score */}
      <div className="glass-section-card p-4">
        <h3 className="text-lg font-bold text-white mb-3 drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]">औसत विश्वास</h3>
        <div className="text-center">
          <div className="text-3xl font-bold text-[#8BF5E6]">
            {formatConfidence(stats.avgConfidence)}
          </div>
          <div className="text-sm text-secondary mt-1">
            Average Confidence
          </div>
        </div>
      </div>

      {/* Low Confidence Alert */}
      {stats.pending > 0 && (
        <div className="glass-section-card p-4 border border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <h3 className="text-sm font-semibold text-red-300">Low Confidence</h3>
          </div>
          <div 
            className="text-sm text-red-300 cursor-pointer hover:text-red-200 transition-colors"
            onClick={() => handleStatClick('low-confidence')}
          >
            {tweets.filter(t => (t.confidence || 0) <= 0.5).length} tweets need attention
          </div>
        </div>
      )}

      {/* Current Position */}
      <div className="glass-section-card p-4">
        <h3 className="text-lg font-bold text-white mb-2 drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]">Current Position</h3>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">
            {currentIndex + 1} / {stats.total}
          </div>
          <div className="text-sm text-secondary">
            Tweet Position
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-section-card p-4">
        <h3 className="text-lg font-bold text-white mb-3 drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]">Quick Actions</h3>
        <div className="space-y-2">
          <button 
            className="w-full text-left text-sm text-[#8BF5E6] hover:text-[#b8fff5] p-2 rounded hover:bg-white/10 transition-colors"
            onClick={() => handleStatusClick('pending')}
          >
            📝 Show Pending Only
          </button>
          <button 
            className="w-full text-left text-sm text-green-400 hover:text-green-300 p-2 rounded hover:bg-white/10 transition-colors"
            onClick={() => handleStatusClick('approved')}
          >
            ✅ Show Approved Only
          </button>
          <button 
            className="w-full text-left text-sm text-amber-400 hover:text-amber-300 p-2 rounded hover:bg-white/10 transition-colors"
            onClick={() => handleStatClick('low-confidence')}
          >
            ⚠️ Show Low Confidence
          </button>
        </div>
      </div>
    </div>
  );
}
