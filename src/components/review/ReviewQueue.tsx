'use client';
import { useState, useEffect, useMemo } from 'react';
import parsedTweets from '../../../data/parsed_tweets.json';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { formatDate } from '@/lib/utils';
import { getConfidenceColor, getConfidenceEmoji, formatConfidence } from '@/lib/colors';
import { Edit, Check, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface ParsedTweet {
  id: string;
  timestamp: string;
  content: string;
  text?: string;
  parsed?: {
    event_type: string;
    event_type_confidence?: number;
    locations?: any[];
    people?: string[];
    people_mentioned?: string[];
    organizations?: string[];
    schemes?: string[];
    schemes_mentioned?: string[];
  };
  confidence?: number;
  needs_review?: boolean;
  review_status?: string;
}

interface Correction {
  field: string;
  before: any;
  after: any;
  reason: string;
  timestamp: string;
}

const EVENT_TYPES = [
  { value: 'meeting', label: 'बैठक (Meeting)' },
  { value: 'rally', label: 'रैली (Rally)' },
  { value: 'inspection', label: 'निरीक्षण (Inspection)' },
  { value: 'inauguration', label: 'उद्घाटन (Inauguration)' },
  { value: 'scheme_announcement', label: 'योजना घोषणा (Scheme Announcement)' },
  { value: 'birthday_wishes', label: 'जन्मदिन शुभकामनाएं (Birthday Wishes)' },
  { value: 'condolence', label: 'शोक संदेश (Condolence)' },
  { value: 'other', label: 'अन्य (Other)' },
];

export default function ReviewQueue() {
  const [tweets, setTweets] = useState<ParsedTweet[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [correctionReason, setCorrectionReason] = useState('');
  const [corrections, setCorrections] = useState<Record<string, Correction[]>>({});
  const [sortBy, setSortBy] = useState<'confidence' | 'date'>('confidence');
  
  useEffect(() => {
    // Load and sort tweets
    const loaded = (parsedTweets as ParsedTweet[]).map(t => ({
      ...t,
      content: t.content || t.text || '',
    }));
    
    const sorted = [...loaded].sort((a, b) => {
      if (sortBy === 'confidence') {
        return (a.confidence || 0) - (b.confidence || 0);
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    setTweets(sorted);
  }, [sortBy]);

  const currentTweet = tweets[currentIndex];
  
  const stats = useMemo(() => {
    const pending = tweets.filter(t => t.review_status !== 'approved').length;
    const reviewed = tweets.filter(t => t.review_status === 'approved').length;
    const avgConfidence = tweets.reduce((sum, t) => sum + (t.confidence || 0), 0) / tweets.length;
    
    return { pending, reviewed, avgConfidence };
  }, [tweets]);

  const handleEdit = () => {
    if (!currentTweet) return;
    
    setEditMode(true);
    setEditedData({
      event_type: currentTweet.parsed?.event_type || 'other',
      locations: currentTweet.parsed?.locations?.map((l: any) => l.name || l) || [],
      people: currentTweet.parsed?.people_mentioned || currentTweet.parsed?.people || [],
      organizations: currentTweet.parsed?.organizations || [],
      schemes: currentTweet.parsed?.schemes_mentioned || currentTweet.parsed?.schemes || [],
    });
    setCorrectionReason('');
  };

  const handleSave = () => {
    if (!currentTweet || !correctionReason.trim()) {
      alert('कृपया सुधार का कारण दर्ज करें (Please enter correction reason)');
      return;
    }
    
    const correction: Correction = {
      field: 'all',
      before: currentTweet.parsed,
      after: editedData,
      reason: correctionReason,
      timestamp: new Date().toISOString(),
    };
    
    setCorrections(prev => ({
      ...prev,
      [currentTweet.id]: [...(prev[currentTweet.id] || []), correction],
    }));
    
    // Update tweet data
    const updatedTweets = [...tweets];
    updatedTweets[currentIndex] = {
      ...currentTweet,
      parsed: {
        ...currentTweet.parsed,
        ...editedData,
      },
      confidence: 1.0,
      review_status: 'corrected',
    };
    setTweets(updatedTweets);
    
    setEditMode(false);
    setCorrectionReason('');
    
    // Log for ML training
    console.log('✅ Correction saved for ML training:', correction);
  };

  const handleApprove = () => {
    if (!currentTweet) return;
    
    const updatedTweets = [...tweets];
    updatedTweets[currentIndex] = {
      ...currentTweet,
      review_status: 'approved',
    };
    setTweets(updatedTweets);
    
    // Move to next
    if (currentIndex < tweets.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleReject = () => {
    if (!currentTweet) return;
    
    const updatedTweets = [...tweets];
    updatedTweets[currentIndex] = {
      ...currentTweet,
      review_status: 'rejected',
      needs_review: true,
    };
    setTweets(updatedTweets);
    
    // Move to next
    if (currentIndex < tweets.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const addEntity = (field: 'locations' | 'people' | 'organizations' | 'schemes') => {
    const newValue = prompt(`नया ${field === 'locations' ? 'स्थान' : field === 'people' ? 'व्यक्ति' : field === 'organizations' ? 'संगठन' : 'योजना'} जोड़ें (Add new ${field}):`);
    if (newValue && newValue.trim()) {
      setEditedData({
        ...editedData,
        [field]: [...(editedData[field] || []), newValue.trim()],
      });
    }
  };

  const removeEntity = (field: 'locations' | 'people' | 'organizations' | 'schemes', index: number) => {
    setEditedData({
      ...editedData,
      [field]: editedData[field].filter((_: any, i: number) => i !== index),
    });
  };

  if (!currentTweet) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-600">कोई ट्वीट समीक्षा के लिए नहीं है (No tweets to review)</p>
      </Card>
    );
  }

  const tweetText = currentTweet.content || currentTweet.text || '';
  const confidence = currentTweet.confidence || 0;
  const confidenceColor = getConfidenceColor(confidence);
  const confidenceEmoji = getConfidenceEmoji(confidence);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center bg-gradient-to-br from-amber-50 to-white">
          <div className="text-3xl font-bold text-amber-600">{stats.pending}</div>
          <div className="text-sm text-gray-600">समीक्षा के लिए (Pending)</div>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-green-50 to-white">
          <div className="text-3xl font-bold text-green-600">{stats.reviewed}</div>
          <div className="text-sm text-gray-600">समीक्षित (Reviewed)</div>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-blue-50 to-white">
          <div className="text-3xl font-bold text-blue-600">{Math.round(stats.avgConfidence * 100)}%</div>
          <div className="text-sm text-gray-600">औसत विश्वास (Avg Confidence)</div>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center">
        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'confidence' | 'date')}
          options={[
            { value: 'confidence', label: 'कम विश्वास पहले (Low confidence first)' },
            { value: 'date', label: 'नवीनतम पहले (Latest first)' },
          ]}
          className="w-64"
        />
        <div className="text-sm text-gray-600">
          Tweet {currentIndex + 1} of {tweets.length}
        </div>
      </div>

      {/* Review Card */}
      <Card className={`border-2 ${confidence < 0.6 ? 'border-red-200' : confidence < 0.8 ? 'border-amber-200' : 'border-green-200'}`}>
        <CardHeader className="bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg mb-1">
                Tweet #{currentTweet.id}
              </CardTitle>
              <p className="text-xs text-gray-500">{formatDate(currentTweet.timestamp, 'en')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{confidenceEmoji}</span>
              <span className="text-sm font-semibold" style={{ color: confidenceColor }}>
                {formatConfidence(confidence)}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Tweet Content */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700 leading-relaxed">{tweetText}</p>
          </div>

          {editMode ? (
            <>
              {/* Edit Mode */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                {/* Event Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎯 घटना प्रकार (Event Type)
                  </label>
                  <Select
                    value={editedData.event_type}
                    onChange={(e) => setEditedData({ ...editedData, event_type: e.target.value })}
                    options={EVENT_TYPES}
                  />
                </div>

                {/* Locations */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      📍 स्थान (Locations)
                    </label>
                    <button
                      onClick={() => addEntity('locations')}
                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editedData.locations?.map((loc: string, i: number) => (
                      <Badge key={i} variant="info" removable onRemove={() => removeEntity('locations', i)}>
                        {loc}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* People */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      👥 लोग (People)
                    </label>
                    <button
                      onClick={() => addEntity('people')}
                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editedData.people?.map((person: string, i: number) => (
                      <Badge key={i} variant="default" removable onRemove={() => removeEntity('people', i)}>
                        {person}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Organizations */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      🏢 संगठन (Organizations)
                    </label>
                    <button
                      onClick={() => addEntity('organizations')}
                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editedData.organizations?.map((org: string, i: number) => (
                      <Badge key={i} variant="default" removable onRemove={() => removeEntity('organizations', i)}>
                        {org}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Schemes */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      📋 योजनाएं (Schemes)
                    </label>
                    <button
                      onClick={() => addEntity('schemes')}
                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editedData.schemes?.map((scheme: string, i: number) => (
                      <Badge key={i} variant="warning" removable onRemove={() => removeEntity('schemes', i)}>
                        {scheme}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Correction Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💬 सुधार का कारण (Why are you making this change?) *
                  </label>
                  <Input
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="e.g., Tweet mentions birthday wishes, not a rally"
                    className="w-full"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* View Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">🎯 घटना प्रकार</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {EVENT_TYPES.find(t => t.value === currentTweet.parsed?.event_type)?.label || currentTweet.parsed?.event_type}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">📍 स्थान</div>
                  <div className="flex flex-wrap gap-1">
                    {(currentTweet.parsed?.locations || []).map((loc: any, i: number) => (
                      <Badge key={i} variant="info">{loc.name || loc}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">👥 लोग</div>
                  <div className="flex flex-wrap gap-1">
                    {(currentTweet.parsed?.people_mentioned || currentTweet.parsed?.people || []).map((person: string, i: number) => (
                      <Badge key={i}>{person}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">🏢 संगठन</div>
                  <div className="flex flex-wrap gap-1">
                    {(currentTweet.parsed?.organizations || []).map((org: string, i: number) => (
                      <Badge key={i}>{org}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentIndex(Math.min(tweets.length - 1, currentIndex + 1))}
              disabled={currentIndex === tweets.length - 1}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button variant="success" size="sm" onClick={handleSave}>
                  <Check className="w-4 h-4 mr-1" /> Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="danger" size="sm" onClick={handleReject}>
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button variant="secondary" size="sm" onClick={handleEdit}>
                  <Edit className="w-4 h-4 mr-1" /> Edit
                </Button>
                <Button variant="success" size="sm" onClick={handleApprove}>
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Correction Log (if any) */}
      {corrections[currentTweet.id] && (
        <Card className="p-4 bg-green-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">✅ Corrections Applied:</h3>
          {corrections[currentTweet.id].map((corr, i) => (
            <div key={i} className="text-xs text-gray-700 mb-1">
              • {corr.reason} ({new Date(corr.timestamp).toLocaleString()})
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

