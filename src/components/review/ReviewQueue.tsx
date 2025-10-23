'use client';
import { useState, useEffect, useMemo } from 'react';
import parsedTweets from '../../../data/parsed_tweets.json';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { EVENT_TYPE_OPTIONS, getEventTypeHindi } from '@/lib/eventTypes';
import { api } from '@/lib/api';
import Badge from '../ui/Badge';
import { formatDate } from '@/lib/utils';
import { getConfidenceColor, getConfidenceEmoji, formatConfidence } from '@/lib/colors';
import { Edit, Check, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import TagsSelector from './TagsSelector';
import LocationHierarchyPicker, { GeoNode } from './LocationHierarchyPicker';
import AutocompleteInput from './AutocompleteInput';
import ProgressSidebar from './ProgressSidebar';

interface ParsedTweet {
  id: string;
  timestamp: string;
  content: string;
  text?: string;
  parsedEventId?: number; // server-side parsed_events.id when available
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

const EVENT_TYPES = EVENT_TYPE_OPTIONS;

export default function ReviewQueue() {
  const [tweets, setTweets] = useState<ParsedTweet[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [correctionReason, setCorrectionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [corrections, setCorrections] = useState<Record<string, Correction[]>>({});
  const [sortBy, setSortBy] = useState<'confidence' | 'date'>('confidence');
  const [customEventTypes, setCustomEventTypes] = useState<string[]>([]);
  const allEventOptions = useMemo(() => {
    const custom = customEventTypes.map((s) => ({ value: s, label: s }));
    const merged = [...EVENT_TYPE_OPTIONS, ...custom];
    const seen = new Set<string>();
    return merged.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
  }, [customEventTypes]);
  
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Try server queue first
      try {
        const res = await api.get<{ success: boolean; events: any[] }>(`/api/parsed-events?needs_review=true&limit=100`);
        if (mounted && res.success && res.events && res.events.length > 0) {
          const mapped: ParsedTweet[] = res.events.map((e) => ({
            id: String(e.tweet_id),
            parsedEventId: e.id,
            timestamp: e.tweet_created_at,
            content: e.tweet_text,
            parsed: {
              event_type: e.event_type,
              event_type_confidence: e.event_type_confidence,
              locations: (e.locations || []).map((l: any) => l.name || l),
              people_mentioned: e.people_mentioned || [],
              organizations: e.organizations || [],
              schemes_mentioned: e.schemes_mentioned || [],
            },
            confidence: e.overall_confidence,
            needs_review: e.needs_review,
            review_status: e.review_status,
          }));
          const sorted = [...mapped].sort((a, b) => {
            if (sortBy === 'confidence') return (a.confidence || 0) - (b.confidence || 0);
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });
          setTweets(sorted);
          return;
        }
      } catch (error) {
        // console.log('API not available, using static data:', error);
      }

      // Fallback to static JSON
      const loaded = (parsedTweets as ParsedTweet[]).map(t => ({
        ...t,
        content: t.content || t.text || '',
        needs_review: t.needs_review !== false, // Default to true for review
        review_status: t.review_status || 'pending',
      }));
      const sorted = [...loaded].sort((a, b) => {
        if (sortBy === 'confidence') return (a.confidence || 0) - (b.confidence || 0);
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      if (mounted) setTweets(sorted);
    })();
    return () => { mounted = false; };
  }, [sortBy]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('customEventTypes');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCustomEventTypes(arr.filter((x) => typeof x === 'string'));
      }
    } catch {}
  }, []);

  const addCustomEventType = (label: string) => {
    const val = (label || '').trim();
    if (!val) return;
    const exists = allEventOptions.some((o) => o.value === val);
    if (exists) return;
    const next = [...customEventTypes, val];
    setCustomEventTypes(next);
    try {
      localStorage.setItem('customEventTypes', JSON.stringify(next));
    } catch {}
  };

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
      // prefer hierarchical paths if present; otherwise convert to name-only nodes
      locationsPaths: (currentTweet as any).parsed?.locations || [],
      locations: currentTweet.parsed?.locations?.map((l: any) => l.name || l) || [],
      people: currentTweet.parsed?.people_mentioned || currentTweet.parsed?.people || [],
      organizations: currentTweet.parsed?.organizations || [],
      schemes: currentTweet.parsed?.schemes_mentioned || currentTweet.parsed?.schemes || [],
    });
    setCorrectionReason('');
    
    // Load existing notes
    try {
      const notesKey = `tweet_notes:${String(currentTweet.id)}`;
      const notesRaw = localStorage.getItem(notesKey);
      if (notesRaw) {
        const notesData = JSON.parse(notesRaw);
        setNotes(notesData.notes || '');
      } else {
        setNotes('');
      }
    } catch {
      setNotes('');
    }
  };

  const handleSave = async () => {
    if (!currentTweet || !correctionReason.trim()) {
      alert('कृपया सुधार का कारण दर्ज करें (Please enter correction reason)');
      return;
    }
    if (editedData?.event_type && !allEventOptions.some((o) => o.value === editedData.event_type)) {
      addCustomEventType(editedData.event_type);
    }
    
    const correction: Correction = {
      field: 'all',
      before: currentTweet.parsed,
      after: editedData,
      reason: correctionReason,
      timestamp: new Date().toISOString(),
    };
    
    // Store notes separately
    if (notes.trim()) {
      try {
        const notesKey = `tweet_notes:${String(currentTweet.id)}`;
        localStorage.setItem(notesKey, JSON.stringify({
          notes: notes.trim(),
          timestamp: new Date().toISOString(),
        }));
      } catch {}
    }
    
    setCorrections(prev => ({
      ...prev,
      [currentTweet.id]: [...(prev[currentTweet.id] || []), correction],
    }));
    
    // Update tweet data (local state)
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
    
    // Persist edit to localStorage for Home tab overlay
    try {
      const key = `tweet_review:${String(currentTweet.id)}`;
      const payload = {
        event_type: editedData.event_type,
        locations: editedData.locations || [],
        people_mentioned: editedData.people || [],
        organizations: editedData.organizations || [],
        schemes_mentioned: editedData.schemes || [],
        review_status: 'edited',
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
      // maintain a simple index of reviewed ids
      const idxKey = 'tweet_review_index';
      const idxRaw = localStorage.getItem(idxKey);
      const idx = idxRaw ? Array.from(new Set([...(JSON.parse(idxRaw) || []), String(currentTweet.id)])) : [String(currentTweet.id)];
      localStorage.setItem(idxKey, JSON.stringify(idx));
      // trigger storage listeners for live refresh
      localStorage.setItem('tweet_review_refresh_ts', String(Date.now()));
    } catch {}

    // Try server persistence (requires parsedEventId)
    try {
      const evId = currentTweet.parsedEventId;
      if (evId) {
        // Build locations payload: prefer hierarchical paths if provided
        const locs = Array.isArray(editedData.locationsPaths) && editedData.locationsPaths.length
          ? editedData.locationsPaths
          : (editedData.locations || []).map((n: string) => ({ name: n }));
        await api.put(`/api/parsed-events/${encodeURIComponent(evId)}`, {
          event_type: editedData.event_type,
          locations: locs,
          people_mentioned: editedData.people || [],
          organizations: editedData.organizations || [],
          schemes_mentioned: editedData.schemes || [],
          reviewed_by: 'reviewer',
        });
      }
    } catch {
      // ignore; local overlay already applied
    }

    setEditMode(false);
    setCorrectionReason('');
    
    // Log for ML training
    // console.log('✅ Correction saved for ML training:', correction);
  };

  const handleApprove = async () => {
    if (!currentTweet) return;
    
    const updatedTweets = [...tweets];
    updatedTweets[currentIndex] = {
      ...currentTweet,
      review_status: 'approved',
    };
    setTweets(updatedTweets);

    // Persist approval status to localStorage overlay
    try {
      const key = `tweet_review:${String(currentTweet.id)}`;
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const payload = {
        ...existing,
        review_status: 'approved',
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
      const idxKey = 'tweet_review_index';
      const idxRaw = localStorage.getItem(idxKey);
      const idx = idxRaw ? Array.from(new Set([...(JSON.parse(idxRaw) || []), String(currentTweet.id)])) : [String(currentTweet.id)];
      localStorage.setItem(idxKey, JSON.stringify(idx));
      localStorage.setItem('tweet_review_refresh_ts', String(Date.now()));
    } catch {}
    
    // Server approve (requires parsedEventId)
    try {
      const evId = currentTweet.parsedEventId;
      if (evId) await api.post(`/api/parsed-events/${encodeURIComponent(evId)}/approve`, { reviewed_by: 'reviewer' });
    } catch {}

    // Move to next
    const nextIndex = currentIndex + 1;
    // Remove approved from pending queue view
    setTweets(prev => prev.filter((t, idx) => idx !== currentIndex));
    if (nextIndex <= tweets.length - 1) setCurrentIndex(Math.min(nextIndex, tweets.length - 2));
  };

  const handleSkip = async () => {
    if (!currentTweet) return;
    // Update local state: remove from queue
    setTweets(prev => prev.filter((_, idx) => idx !== currentIndex));
    // Persist skip to overlay and backend
    try {
      const key = `tweet_review:${String(currentTweet.id)}`;
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      localStorage.setItem(key, JSON.stringify({ ...existing, review_status: 'skipped', updated_at: new Date().toISOString() }));
      localStorage.setItem('tweet_review_refresh_ts', String(Date.now()));
    } catch {}
    try {
      const evId = currentTweet.parsedEventId;
      if (evId) await api.post(`/api/parsed-events/${encodeURIComponent(evId)}/skip`, { reviewed_by: 'reviewer' });
    } catch {}
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

  const handleSaveAndApprove = async () => {
    if (!correctionReason.trim()) {
      alert('कृपया सुधार का कारण दर्ज करें (Please enter correction reason)');
      return;
    }
    await handleSave();
    await handleApprove();
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
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">समीक्षा के लिए कोई ट्वीट नहीं</h3>
          <p className="text-gray-500 mb-4">
            {tweets.length === 0 
              ? "अभी समीक्षा के लिए कोई ट्वीट उपलब्ध नहीं है। कृपया बाद में पुनः प्रयास करें।"
              : "सभी ट्वीट की समीक्षा पूर्ण हो गई है।"
            }
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="primary" onClick={() => window.location.reload()}>
              🔄 पुनः लोड करें
            </Button>
            {tweets.length > 0 && (
              <Button variant="secondary" onClick={() => setCurrentIndex(0)}>
                📝 पहला ट्वीट देखें
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const tweetText = currentTweet.content || currentTweet.text || '';
  const confidence = currentTweet.confidence || 0;
  const confidenceColor = getConfidenceColor(confidence);
  const confidenceEmoji = getConfidenceEmoji(confidence);

  const formatLocLabel = (loc: any) => {
    // Accept name-only or hierarchical path
    if (loc && Array.isArray(loc.path)) {
      const parts = loc.path.map((n: any) => {
        if (!n?.name) return null;
        return (n.type || '').toLowerCase() === 'ward' ? `Ward ${n.name}` : n.name;
      }).filter(Boolean);
      return parts.join(' › ');
    }
    return loc?.name || String(loc || '');
  };

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
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
      <Card className={`border-2 bg-white ${confidence <= 0.5 ? 'border-red-500' : confidence <= 0.8 ? 'border-yellow-500' : 'border-green-500'}`}>
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
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-900 leading-relaxed">{tweetText}</p>
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
                  <AutocompleteInput
                    fieldName="event_type"
                    value={editedData.event_type || ''}
                    onChange={(value) => setEditedData({ ...editedData, event_type: value })}
                    placeholder="e.g., जन्मदिन शुभकामनाएं, बैठक, रैली, निरीक्षण, उद्घाटन"
                    className="w-full"
                  />
                </div>

                {/* Locations - hierarchical picker */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      📍 स्थान (Locations)
                    </label>
                  </div>
                  <LocationHierarchyPicker
                    value={editedData.locationsPaths || []}
                    onChange={(paths) => setEditedData({ ...editedData, locationsPaths: paths })}
                  />
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
                  <AutocompleteInput
                    fieldName="people"
                    value={(editedData.people || []).join(', ')}
                    onChange={(value) => setEditedData({ ...editedData, people: value.split(',').map((s:string)=>s.trim()).filter(Boolean) })}
                    placeholder="e.g., रमन सिंह, नरेंद्र मोदी"
                    className="w-full"
                  />
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
                  <AutocompleteInput
                    fieldName="organizations"
                    value={(editedData.organizations || []).join(', ')}
                    onChange={(value) => setEditedData({ ...editedData, organizations: value.split(',').map((s:string)=>s.trim()).filter(Boolean) })}
                    placeholder="e.g., भाजपा, राज्य शासन"
                    className="w-full"
                  />
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
                  <AutocompleteInput
                    fieldName="schemes"
                    value={(editedData.schemes || []).join(', ')}
                    onChange={(value) => setEditedData({ ...editedData, schemes: value.split(',').map((s:string)=>s.trim()).filter(Boolean) })}
                    placeholder="e.g., प्रधानमंत्री आवास योजना, महतारी वंदन योजना"
                    className="w-full"
                  />
                </div>

                {/* Topics / Tags */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      🏷️ विषय (Topics/Tags)
                    </label>
                  </div>
                  <TagsSelector
                    tweetId={String(currentTweet.id)}
                    initialSelected={(currentTweet as any).parsed?.topics?.map((t: any) => t.label_hi) || []}
                    onChange={(vals) => {
                      setEditedData({ ...editedData, topics: vals });
                      try {
                        const key = `tweet_review:${String(currentTweet.id)}`;
                        const raw = localStorage.getItem(key);
                        const existing = raw ? JSON.parse(raw) : {};
                        localStorage.setItem(key, JSON.stringify({ ...existing, topics: vals, updated_at: new Date().toISOString() }));
                        localStorage.setItem('tweet_review_refresh_ts', String(Date.now()));
                      } catch {}
                    }}
                  />
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

                {/* Notes Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📝 नोट्स (Notes) - Optional
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes, edge cases, or training data annotations..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
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
                    {getEventTypeHindi(currentTweet.parsed?.event_type)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">📍 स्थान</div>
                  <div className="flex flex-wrap gap-1">
                    {(currentTweet.parsed?.locations || []).map((loc: any, i: number) => (
                      <Badge key={i} variant="info">{formatLocLabel(loc)}</Badge>
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
                <div className="col-span-2">
                  <div className="text-xs font-medium text-gray-500 mb-1">🏷️ विषय (Topics/Tags)</div>
                  <div className="flex flex-wrap gap-1">
                    {(((currentTweet as any).parsed?.topics) || []).map((t: any, i: number) => (
                      <Badge key={i}>{t?.label_hi || t?.label || String(t)}</Badge>
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
                <Button variant="success" size="sm" onClick={handleSaveAndApprove}>
                  <Check className="w-4 h-4 mr-1" /> Save & Approve
                </Button>
              </>
            ) : (
              <>
                <Button variant="danger" size="sm" onClick={handleReject}>
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button variant="secondary" size="sm" onClick={handleSkip}>
                  Skip
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
      
      {/* Progress Sidebar */}
      <ProgressSidebar 
        tweets={tweets}
        currentIndex={currentIndex}
        onJumpToTweet={(index) => setCurrentIndex(index)}
      />
    </div>
  );
}

