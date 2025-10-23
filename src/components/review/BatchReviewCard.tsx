'use client';

import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { formatDate } from '@/lib/utils';
import { getConfidenceColor, getConfidenceEmoji, formatConfidence } from '@/lib/colors';
import { Check, X, Edit } from 'lucide-react';

interface ParsedTweet {
  id: string;
  timestamp: string;
  content: string;
  parsed?: {
    event_type: string;
    locations?: any[];
    people_mentioned?: string[];
    organizations?: string[];
    schemes_mentioned?: string[];
  };
  confidence?: number;
  review_status?: string;
}

interface BatchReviewCardProps {
  tweet: ParsedTweet;
  onApprove: (tweetId: string) => void;
  onReject: (tweetId: string) => void;
  onEdit: (tweetId: string) => void;
  onSkip: (tweetId: string) => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function BatchReviewCard({
  tweet,
  onApprove,
  onReject,
  onEdit,
  onSkip,
  isSelected = false,
  onSelect
}: BatchReviewCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const confidence = tweet.confidence || 0;
  const confidenceColor = getConfidenceColor(confidence);
  const confidenceEmoji = getConfidenceEmoji(confidence);
  
  const tweetText = tweet.content || '';
  const truncatedText = tweetText.length > 120 ? tweetText.substring(0, 120) + '...' : tweetText;

  const formatLocLabel = (loc: any) => {
    if (loc && Array.isArray(loc.path)) {
      const parts = loc.path.map((n: any) => {
        if (!n?.name) return null;
        return (n.type || '').toLowerCase() === 'ward' ? `Ward ${n.name}` : n.name;
      }).filter(Boolean);
      return parts.join(' › ');
    }
    return loc?.name || String(loc || '');
  };

  const getConfidenceBorderColor = (confidence: number) => {
    if (confidence <= 0.5) return 'border-red-500';
    if (confidence <= 0.8) return 'border-yellow-500';
    return 'border-green-500';
  };

  return (
    <Card 
      className={`border-2 bg-white cursor-pointer transition-all duration-200 ${
        getConfidenceBorderColor(confidence)
      } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${isHovered ? 'shadow-lg' : 'shadow-sm'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-sm mb-1">
              Tweet #{tweet.id}
            </CardTitle>
            <p className="text-xs text-gray-500">{formatDate(tweet.timestamp, 'en')}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-lg">{confidenceEmoji}</span>
            <span className="text-xs font-semibold" style={{ color: confidenceColor }}>
              {formatConfidence(confidence)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Tweet Content */}
        <div className="bg-gray-50 p-3 rounded text-xs text-gray-900 leading-relaxed">
          {truncatedText}
        </div>

        {/* Parsed Data */}
        <div className="space-y-2">
          {/* Event Type */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">🎯 Event Type</div>
            <div className="text-xs font-semibold text-gray-900">
              {tweet.parsed?.event_type || 'N/A'}
            </div>
          </div>

          {/* Locations */}
          {tweet.parsed?.locations && tweet.parsed.locations.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">📍 Locations</div>
              <div className="flex flex-wrap gap-1">
                {tweet.parsed.locations.slice(0, 2).map((loc: any, i: number) => (
                  <Badge key={i} variant="info" className="text-xs">
                    {formatLocLabel(loc)}
                  </Badge>
                ))}
                {tweet.parsed.locations.length > 2 && (
                  <Badge variant="info" className="text-xs">
                    +{tweet.parsed.locations.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* People */}
          {tweet.parsed?.people_mentioned && tweet.parsed.people_mentioned.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">👥 People</div>
              <div className="flex flex-wrap gap-1">
                {tweet.parsed.people_mentioned.slice(0, 2).map((person: string, i: number) => (
                  <Badge key={i} className="text-xs">{person}</Badge>
                ))}
                {tweet.parsed.people_mentioned.length > 2 && (
                  <Badge className="text-xs">
                    +{tweet.parsed.people_mentioned.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <div className="flex gap-1 w-full">
          <Button
            variant="success"
            size="sm"
            className="flex-1 text-xs py-1 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onApprove(tweet.id);
            }}
          >
            <Check className="w-3 h-3 mr-1" />
            Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="flex-1 text-xs py-1 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onReject(tweet.id);
            }}
          >
            <X className="w-3 h-3 mr-1" />
            Reject
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs py-1 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(tweet.id);
            }}
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs py-1 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onSkip(tweet.id);
            }}
          >
            Skip
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
