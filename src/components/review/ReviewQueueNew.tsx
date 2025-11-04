'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Edit, 
  Check, 
  X, 
  SkipForward, 
  Brain, 
  ChevronLeft, 
  ChevronRight, 
  Bell, 
  HelpCircle, 
  Settings, 
  Send, 
  Search, 
  X as CloseIcon, 
  Plus, 
  Trash2 
} from 'lucide-react';
import AIAssistantModal from './AIAssistantModal';
import GeoHierarchyTree from './GeoHierarchyTree';
import GeoHierarchyEditor from './GeoHierarchyEditor';
import { GeoHierarchy } from '@/lib/geo-extraction/hierarchy-resolver';
import { api } from '@/lib/api';
import { logger } from '@/lib/utils/logger';

// Empty array - will be populated from API
const initialTweets: any[] = [];

const getEventTypeHindi = (eventType: string) => {
  const translations: Record<string, string> = {
    'birthday_wishes': 'जन्मदिन शुभकामनाएं',
    'scheme_announcement': 'योजना घोषणा',
    'inauguration': 'उद्घाटन',
    'meeting': 'बैठक',
    'rally': 'रैली',
    'inspection': 'निरीक्षण',
    'tribute': 'श्रद्धांजलि',
    'other': 'अन्य'
  };
  return translations[eventType] || eventType;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('hi-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function ReviewQueueNew() {
  logger.debug('ReviewQueueNew: Component mounting...');
  
  // Initialize with empty array - will be populated from API
  const [tweets, setTweets] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [correctionReason, setCorrectionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [sortBy, setSortBy] = useState<'confidence' | 'date'>('confidence');
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      type: 'ai',
      content: 'नमस्कार! मैं आपका AI सहायक हूँ जो इस ट्वीट के विवरण को परिष्कृत करने में आपकी मदद करने के लिए तैयार है। आप क्या अपडेट या स्पष्ट करना चाहेंगे?',
      suggestions: ['कार्यक्रम का प्रकार सेट करें', 'स्थान जोड़ें', 'टैग सुझाएं']
    }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [tags, setTags] = useState(['शहरी विकास', 'हरित अवसंरचना', 'स्थिरता', 'शहरी नियोजन']);
  const [availableTags, setAvailableTags] = useState(['सार्वजनिक स्थान', 'सामुदायिक जुड़ाव']);
  const [loading, setLoading] = useState(true); // Loading state for API fetch

  const currentTweet = useMemo(() => tweets[currentIndex], [tweets, currentIndex]);

  // Add missing functions
  const handleAISend = async (message: string) => {
    if (!message.trim()) return;

    const userInput = message;

    // Add loading message
    const loadingMessage = {
      type: 'ai',
      content: 'सोच रहा हूँ...',
      suggestions: []
    };
    setAiMessages(prev => [...prev, loadingMessage]);

    try {
      // Call AI Assistant API
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput,
          tweetData: currentTweet
        })
      });

      const data = await response.json();
      
      // Remove loading message
      setAiMessages(prev => prev.slice(0, -1));
      
      if (data.success) {
        const aiResponse = {
          type: 'ai',
          content: data.response,
          suggestions: ['अन्य फ़ील्ड की समीक्षा करें', 'नए टैग सुझाएं', 'स्थान जोड़ें']
        };
        setAiMessages(prev => [...prev, aiResponse]);
      } else {
        throw new Error(data.error || 'AI Assistant error');
      }
    } catch (error) {
      logger.error('AI Assistant error:', error as Error);
      // Remove loading message
      setAiMessages(prev => prev.slice(0, -1));
      
      const errorResponse = {
        type: 'ai',
        content: 'क्षमा करें, मैं इस समय आपकी सहायता नहीं कर सकता। कृपया बाद में पुनः प्रयास करें।',
        suggestions: ['पुनः प्रयास करें']
      };
      setAiMessages(prev => [...prev, errorResponse]);
    }
  };

  const handleSkip = () => {
    if (currentIndex < tweets.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    setEditMode(false);
    setEditedData({});
    setCorrectionReason('');
  };

  const handleReject = async () => {
    if (!currentTweet) return;
    
    try {
      const response = await fetch('/api/parsed-events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: currentTweet.id,
          review_status: 'rejected',
          needs_review: true,
        })
      });

      if (response.ok) {
        setTweets(prev => prev.map(tweet => 
          tweet.id === currentTweet.id 
            ? { ...tweet, review_status: 'rejected', needs_review: true }
            : tweet
        ));
        
        // Move to next tweet
        handleSkip();
      }
    } catch (error) {
      logger.error('Error rejecting tweet:', error as Error);
    }
  };

  const handleSaveAndApprove = async () => {
    if (!currentTweet || !correctionReason.trim()) {
      alert('कृपया सुधार का कारण दर्ज करें');
      return;
    }
    
    await handleSave();
    await handleApprove();
  };

  const handleApprove = async () => {
    try {
      // First, learn from human feedback if there were corrections
      if (Object.keys(editedData).length > 0) {
        const learningResponse = await fetch('/api/learning', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'learn_from_feedback',
            data: {
              tweetId: currentTweet.tweet_id,
              originalParsed: currentTweet,
              humanCorrection: { ...currentTweet, ...editedData },
              reviewer: 'human'
            }
          })
        });

        if (learningResponse.ok) {
          const learningResult = await learningResponse.json();
          logger.info('Learning from feedback:', learningResult);
        }
      }

      // Update the parsed event status
      const response = await fetch('/api/parsed-events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: currentTweet.id,
          review_status: 'approved',
          needs_review: false,
          ...editedData
        })
      });

      if (response.ok) {
        // Update local state
        setTweets(prev => prev.map(tweet => 
          tweet.id === currentTweet.id 
            ? { ...tweet, review_status: 'approved', needs_review: false, ...editedData }
            : tweet
        ));
        
        // Move to next tweet
        handleSkip();
      } else {
        logger.error('Failed to approve tweet');
      }
    } catch (error) {
      logger.error('Error approving tweet:', error as Error);
    }
  };

  const addTag = (tag: string) => {
    setTags(prev => [...prev, tag]);
    setAvailableTags(prev => prev.filter(t => t !== tag));
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
    setAvailableTags(prev => [...prev, tag]);
  };
  const [showSchemeSuggestions, setShowSchemeSuggestions] = useState(false);
  const [showEventSuggestions, setShowEventSuggestions] = useState(false);
  const [schemeSuggestions, setSchemeSuggestions] = useState<Array<{name_hi: string; name_en: string; category: string}>>([]);
  const [eventSuggestions, setEventSuggestions] = useState<Array<{name_hi: string; name_en: string; category: string}>>([]);
  const [intelligentSuggestions, setIntelligentSuggestions] = useState<any>(null);

  // Fetch intelligent suggestions when entering edit mode
  const fetchIntelligentSuggestions = async () => {
    try {
      const response = await fetch('/api/learning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_suggestions',
          data: {
            tweetText: `Tweet ID: ${currentTweet.tweet_id}`, // We don't have tweet text in parsed data
            currentParsed: currentTweet
          }
        })
      });

      if (response.ok) {
        const suggestions = await response.json();
        setIntelligentSuggestions(suggestions);
        logger.debug('Intelligent suggestions:', suggestions);
      }
    } catch (error) {
      logger.error('Error fetching intelligent suggestions:', error as Error);
    }
  };

  // Fetch suggestions as user types
  const fetchSuggestions = async (type: string, query: string) => {
    try {
      const response = await fetch(`/api/reference/learn?type=${type}&q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.success) {
        if (type === 'scheme') {
          setSchemeSuggestions(data.suggestions);
          setShowSchemeSuggestions(true);
        } else if (type === 'event_type') {
          setEventSuggestions(data.suggestions);
          setShowEventSuggestions(true);
        }
      }
    } catch (error) {
      logger.error('Error fetching suggestions:', error as Error);
    }
  };

  // When user adds new value, save to learning system
  const handleAddNewValue = async (type: string, valueHi: string, valueEn?: string) => {
    try {
      const response = await fetch('/api/reference/learn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_type: type,
          value_hi: valueHi,
          value_en: valueEn || valueHi,
          source_tweet_id: currentTweet?.tweet_id,
          approved_by: 'human'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Show success message
        alert('नया मान जोड़ा गया और सुझावों में सहेजा गया!');
        
        // Refresh suggestions
        if (type === 'scheme') {
          fetchSuggestions('scheme', '');
        } else if (type === 'event_type') {
          fetchSuggestions('event_type', '');
        }
      }
    } catch (error) {
      logger.error('Error saving new value:', error as Error);
      alert('नया मान सहेजने में त्रुटि हुई');
    }
  };

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Ctrl+S or Cmd+S to save while editing
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          if (editMode && correctionReason.trim()) {
            handleSaveAndApprove();
          }
        }
        return;
      }

      // Keyboard shortcuts (only when not in input fields)
      switch (e.key.toLowerCase()) {
        case 'a':
          if (!editMode) {
            e.preventDefault();
            handleApprove();
          }
          break;
        case 'e':
          if (!editMode) {
            e.preventDefault();
            setEditMode(true);
            setEditedData({
              event_type: currentTweet?.event_type || '',
              locations: currentTweet?.locations || [],
              people_mentioned: currentTweet?.people_mentioned || [],
              organizations: currentTweet?.organizations || [],
              schemes_mentioned: currentTweet?.schemes_mentioned || [],
            });
            fetchIntelligentSuggestions();
          }
          break;
        case 'r':
          if (!editMode) {
            e.preventDefault();
            handleReject();
          }
          break;
        case 's':
          if (!editMode) {
            e.preventDefault();
            handleSkip();
          }
          break;
        case 'escape':
          if (editMode) {
            e.preventDefault();
            setEditMode(false);
            setEditedData({});
            setCorrectionReason('');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editMode,
    currentTweet,
    correctionReason,
    fetchIntelligentSuggestions,
    handleApprove,
    handleReject,
    handleSaveAndApprove,
    handleSkip
  ]);

  // Fetch tweets from API on component mount - only events that need review
  useEffect(() => {
    logger.debug('ReviewQueueNew: useEffect triggered - fetching tweets that need review');
    
    const fetchTweets = async () => {
      try {
        logger.debug('ReviewQueueNew: Starting to fetch tweets that need review...');
        setLoading(true);
        
        // Fetch only events that need review
        const response = await fetch('/api/parsed-events?needs_review=true&limit=200');
        logger.debug('ReviewQueueNew: Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        logger.debug('ReviewQueueNew: API result:', { success: result.success, count: result.data?.length || result.events?.length });
        
        if (result.success) {
          // Use data or events (backward compatibility)
          const rawData = result.data || result.events || [];
          
          // Map to expected format
          const reviewTweets = rawData.map((t: any) => ({
            id: t.parsedEventId || t.id,
            tweet_id: t.tweet_id || t.id,
            event_type: t.event_type || 'other',
            event_date: t.event_date || t.timestamp || t.created_at,
            locations: Array.isArray(t.locations) 
              ? t.locations.map((l: any) => typeof l === 'string' ? l : (l.name || l.location || l))
              : [],
            people_mentioned: Array.isArray(t.people_mentioned) ? t.people_mentioned : [],
            organizations: Array.isArray(t.organizations) ? t.organizations : [],
            schemes_mentioned: Array.isArray(t.schemes_mentioned) ? t.schemes_mentioned : [],
            overall_confidence: String(t.overall_confidence || t.confidence || '0'),
            needs_review: t.needs_review !== false, // Ensure it's true
            review_status: t.review_status || 'pending',
            parsed_at: t.parsed_at || t.timestamp || t.created_at,
            parsed_by: t.parsed_by || 'system',
            tweet_text: t.tweet_text || t.content || t.text || '',
          }));
          
          // Sort by confidence (lowest first) or date
          const sortedTweets = [...reviewTweets].sort((a, b) => {
            if (sortBy === 'confidence') {
              return parseFloat(a.overall_confidence) - parseFloat(b.overall_confidence);
            }
            return new Date(b.event_date || b.parsed_at).getTime() - new Date(a.event_date || a.parsed_at).getTime();
          });
          
          logger.debug('ReviewQueueNew: Mapped and sorted tweets:', sortedTweets.length);
          setTweets(sortedTweets);
          
          if (sortedTweets.length === 0) {
            logger.info('ReviewQueueNew: No tweets need review');
          }
        } else {
          logger.error('Failed to fetch tweets:', result.error);
          setTweets([]); // Empty array - no static fallback
        }
      } catch (error) {
        logger.error('Error fetching tweets:', error as Error);
        setTweets([]); // Empty array - no static fallback
      } finally {
        logger.debug('ReviewQueueNew: Setting loading to false');
        setLoading(false);
      }
    };

    fetchTweets();
  }, [sortBy]); // Re-fetch when sortBy changes

  logger.debug('ReviewQueueNew: tweets length:', tweets.length);
  logger.debug('ReviewQueueNew: currentIndex:', currentIndex);
  logger.debug('ReviewQueueNew: currentTweet:', currentTweet);
  
  const stats = useMemo(() => {
    const pending = tweets.filter(t => t.review_status !== 'approved').length;
    const reviewed = tweets.filter(t => t.review_status === 'approved').length;
    const avgConfidence = tweets.reduce((sum, t) => sum + (parseFloat(t.overall_confidence) || 0), 0) / tweets.length;
    
    logger.debug('ReviewQueueNew: stats calculated:', { pending, reviewed, avgConfidence });
    return { pending, reviewed, avgConfidence };
  }, [tweets]);

  const handleEdit = () => {
    if (!currentTweet) return;
    
    setEditMode(true);
    setEditedData({
      event_type: currentTweet.event_type || 'other',
      locations: currentTweet.locations || [],
      people: currentTweet.people_mentioned || [],
      organizations: currentTweet.organizations || [],
      schemes: currentTweet.schemes_mentioned || [],
    });
    setCorrectionReason('');
    
    // Fetch intelligent suggestions when entering edit mode
    fetchIntelligentSuggestions();
  };

  const handleSave = async () => {
    if (!currentTweet || !correctionReason.trim()) {
      alert('कृपया सुधार का कारण दर्ज करें (Please enter correction reason)');
      return;
    }
    
    try {
      // Save corrections to learning system
      const learningResponse = await fetch('/api/learning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'learn_from_feedback',
          data: {
            tweetId: currentTweet.tweet_id,
            originalParsed: currentTweet,
            humanCorrection: { ...currentTweet, ...editedData },
            correctionReason: correctionReason,
            reviewer: 'human'
          }
        })
      });

      if (learningResponse.ok) {
        const learningResult = await learningResponse.json();
        logger.info('Learning from feedback:', learningResult);
      }
      
      // Update parsed event
      const response = await fetch('/api/parsed-events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: currentTweet.id,
          ...editedData,
          correction_reason: correctionReason,
          review_status: 'corrected',
        })
      });

      if (response.ok) {
        setTweets(prev => prev.map(tweet => 
          tweet.id === currentTweet.id 
            ? { ...tweet, ...editedData, review_status: 'corrected' }
            : tweet
        ));
      }
    } catch (error) {
      logger.error('Error saving corrections:', error as Error);
    }
    
    setEditMode(false);
    setCorrectionReason('');
  };




  if (loading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted">समीक्षा डेटा लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  if (!currentTweet) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-primary mb-2">समीक्षा के लिए कोई ट्वीट नहीं</h3>
          <p className="text-secondary mb-4">
            {tweets.length === 0 
              ? "अभी समीक्षा के लिए कोई ट्वीट उपलब्ध नहीं है। कृपया बाद में पुनः प्रयास करें।"
              : "सभी ट्वीट की समीक्षा पूर्ण हो गई है।"
            }
          </p>
        </div>
      </div>
    );
  }

  const tweetText = currentTweet.tweet_id || `Tweet ID: ${currentTweet.id}`;
  const confidence = parseFloat(currentTweet.overall_confidence) || 0;

  return (
    <div className="w-full">
      {/* Main Content */}
      <div className="flex w-full flex-1 flex-col items-center">
        {/* Stats Cards */}
        <div className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="glassmorphic-card glassmorphic-hover rounded-xl p-4">
            <p className="text-sm font-medium text-secondary">समीक्षा के लिए</p>
            <p className="text-2xl font-bold text-primary">{stats.pending}</p>
          </div>
          <div className="glassmorphic-card glassmorphic-hover rounded-xl p-4">
            <p className="text-sm font-medium text-secondary">समीक्षित</p>
            <p className="text-2xl font-bold text-primary">{stats.reviewed}</p>
          </div>
          <div className="glassmorphic-card glassmorphic-hover rounded-xl p-4">
            <p className="text-sm font-medium text-secondary">औसत विश्वास</p>
            <p className="text-2xl font-bold text-primary">{Math.round(stats.avgConfidence * 100)}%</p>
          </div>
        </div>

        {/* Tweet Counter */}
        <p className="mb-4 text-center text-sm font-normal leading-normal text-muted">
          ट्वीट {currentIndex + 1} में से {tweets.length}
        </p>

        {/* Detect ambiguous geo-hierarchy that needs review */}
        {(() => {
          const tweet = currentTweet as any; // Type assertion for geo_hierarchy field
          const hasAmbiguousGeo = tweet.needs_review && 
            tweet.locations && 
            tweet.locations.length > 0 &&
            (tweet.geo_hierarchy?.candidates?.length > 1 || 
             (Array.isArray(tweet.geo_hierarchy) && tweet.geo_hierarchy.length === 0 && tweet.needs_review));
          
          // If we have candidates structure, use it; otherwise check for needs_review flag
          const geoData = tweet.geo_hierarchy;
          const candidates = geoData?.candidates || (geoData && Array.isArray(geoData) ? geoData : []);
          const currentHierarchy = geoData?.hierarchy || (Array.isArray(geoData) && geoData.length === 1 ? geoData[0] : null);
          const explanations = geoData?.explanations || [];
          const locationName = tweet.locations?.[0] || '';

          return hasAmbiguousGeo && candidates.length > 1 ? (
            <GeoHierarchyEditor
              locationName={locationName}
              currentHierarchy={currentHierarchy}
              candidates={candidates}
              needs_review={currentTweet.needs_review || false}
              explanations={explanations}
              onConfirm={async (hierarchy: GeoHierarchy) => {
                try {
                  // Phase 3.3: Wire Learning System via API (server-side only)
                  await api.post('/api/learning', {
                    type: 'geo_correction',
                    original: {
                      location: locationName,
                      hierarchy: currentHierarchy
                    },
                    corrected: hierarchy,
                    user_id: 'user', // TODO: Get from auth context
                    source_id: currentTweet.tweet_id || String(currentTweet.id)
                  });

                  // Update tweet state
                  setTweets(prev => prev.map(tweet => 
                    tweet.id === currentTweet.id 
                      ? { 
                          ...tweet, 
                          geo_hierarchy: hierarchy,
                          needs_review: false 
                        }
                      : tweet
                  ));

                  // Save to database
                  await api.put(`/api/parsed-events/${currentTweet.id}`, {
                    geo_hierarchy: hierarchy,
                    needs_review: false
                  });

                  // Show success message (could add toast notification here)
                  logger.info('✓ Geo-hierarchy correction learned');
                } catch (error) {
                  logger.error('Failed to save geo-hierarchy correction:', error as Error);
                }
              }}
              onReject={() => {
                // On reject, mark as reviewed but keep needs_review flag for manual handling
                setTweets(prev => prev.map(tweet => 
                  tweet.id === currentTweet.id 
                    ? { ...tweet, review_status: 'pending' }
                    : tweet
                ));
              }}
            />
          ) : null;
        })()}

        {/* Tweet Card */}
        <div className="w-full max-w-2xl glassmorphic-card rounded-2xl p-6 shadow-2xl sm:p-8">
          {/* Tweet Header */}
          <div className="flex items-center gap-4">
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-14 w-14" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBNUkxYhQdfbK8RN72N4PUjwW9vbF4OPsUCu8LobAyWyBt0-Ty5BwoXr_Zp6AoaCFf1atiW5TAxUDhxgZR2zLoaElzlAQ_-V7fFo3dALshVsdy_OuJ8XzvwZG_InS1k30-fso8zRKyULYzJ1x84QjNc09mU1Yr2uqnFbOrUxpcZgztKSyRZ1HmTlJTfjSze8Wqs47Y9wUHzhVlxv1VpJvJn_0vM1jZe4kXyWcSxcsCUWpZaHwzIMCl3jx38C-zfTzwTLGUuQXAQeF13")'}}></div>
            <div className="flex flex-col justify-center">
              <p className="text-lg font-medium leading-normal text-primary line-clamp-1">Tweet #{currentTweet.id}</p>
              <p className="text-sm font-normal leading-normal text-muted line-clamp-2">{formatDate(currentTweet.event_date)}</p>
            </div>
            <div className="ml-auto flex items-center gap-2 p-2 rounded-lg bg-mint-green bg-opacity-20 border border-mint-green border-opacity-40">
              <Check className="w-4 h-4 text-mint-green" />
              <p className="text-base font-bold text-mint-green">{Math.round(confidence * 100)}% विश्वास</p>
            </div>
          </div>

          <hr className="my-6 border-white border-opacity-20" />

          {/* Tweet Content */}
          <p className="text-lg font-normal leading-relaxed text-secondary">
            {tweetText}
          </p>

          {/* Parsed Data */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
            <div>
              <p className="text-sm font-medium text-secondary mb-1">दौरा/कार्यक्रम</p>
              <p className="font-semibold text-primary">{getEventTypeHindi(currentTweet.event_type) || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary mb-1">स्थान</p>
              <p className="font-semibold text-primary">{(currentTweet.locations || []).join(', ') || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary mb-1">लोग</p>
              <p className="font-semibold text-primary">{(currentTweet.people_mentioned || []).join(', ') || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary mb-1">संगठन</p>
              <p className="font-semibold text-primary">{(currentTweet.organizations || []).join(', ') || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary mb-1">योजनाएं</p>
              <p className="font-semibold text-primary">{(currentTweet.schemes_mentioned || []).join(', ') || '—'}</p>
            </div>
          </div>

          {/* Geographic Hierarchy */}
          {(currentTweet.locations && currentTweet.locations.length > 0) && (
            <GeoHierarchyTree 
              locations={currentTweet.locations}
              tweetText={tweetText}
              onHierarchyUpdate={(hierarchies) => {
                // Update the tweet data with geo-hierarchy information
                setTweets(prev => prev.map(tweet => 
                  tweet.id === currentTweet.id 
                    ? { ...tweet, geo_hierarchy: hierarchies }
                    : tweet
                ));
              }}
            />
          )}

          {/* Edit Mode */}
          {editMode && (
            <div className="mt-6 flex flex-col space-y-4">
              {/* Event Type with Autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium text-secondary mb-2">दौरा/कार्यक्रम</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-white border-opacity-20 bg-white bg-opacity-5 p-3 text-primary placeholder:text-muted focus:border-mint-green focus:ring-2 focus:ring-mint-green focus:ring-opacity-50"
                  placeholder="दौरा/कार्यक्रम खोजें..."
                  value={editedData.event_type || ''}
                  onChange={(e) => {
                    setEditedData({...editedData, event_type: e.target.value});
                    if (e.target.value.length > 1) {
                      fetchSuggestions('event_type', e.target.value);
                    }
                  }}
                  onFocus={() => setShowEventSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowEventSuggestions(false), 200)}
                />
                {showEventSuggestions && eventSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 glassmorphic-card rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {eventSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-3 hover:bg-white hover:bg-opacity-10 cursor-pointer text-secondary border-b border-white border-opacity-10 last:border-b-0"
                        onClick={() => {
                          setEditedData({...editedData, event_type: suggestion.name_hi});
                          setShowEventSuggestions(false);
                        }}
                      >
                        <div className="font-medium">{suggestion.name_hi}</div>
                        <div className="text-sm text-gray-400">{suggestion.name_en} ({suggestion.category})</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schemes with Autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium text-secondary mb-2">योजनाएं</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-white border-opacity-20 bg-white bg-opacity-5 p-3 text-primary placeholder:text-muted focus:border-mint-green focus:ring-2 focus:ring-mint-green focus:ring-opacity-50"
                  placeholder="योजना खोजें..."
                  value={editedData.schemes || ''}
                  onChange={(e) => {
                    setEditedData({...editedData, schemes: e.target.value});
                    if (e.target.value.length > 1) {
                      fetchSuggestions('scheme', e.target.value);
                    }
                  }}
                  onFocus={() => setShowSchemeSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSchemeSuggestions(false), 200)}
                />
                {showSchemeSuggestions && schemeSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 glassmorphic-card rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {schemeSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-3 hover:bg-white hover:bg-opacity-10 cursor-pointer text-secondary border-b border-white border-opacity-10 last:border-b-0"
                        onClick={() => {
                          setEditedData({...editedData, schemes: suggestion.name_hi});
                          setShowSchemeSuggestions(false);
                        }}
                      >
                        <div className="font-medium">{suggestion.name_hi}</div>
                        <div className="text-sm text-muted">{suggestion.name_en} ({suggestion.category})</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Value Button */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newEventType = prompt('नया दौरा/कार्यक्रम (हिंदी):');
                    const newEventTypeEn = prompt('नया दौरा/कार्यक्रम (अंग्रेजी):');
                    if (newEventType) {
                      handleAddNewValue('event_type', newEventType, newEventTypeEn || undefined);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  नया दौरा/कार्यक्रम जोड़ें
                </button>
                <button
                  onClick={() => {
                    const newScheme = prompt('नई योजना (हिंदी):');
                    const newSchemeEn = prompt('नई योजना (अंग्रेजी):');
                    if (newScheme) {
                      handleAddNewValue('scheme', newScheme, newSchemeEn || undefined);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  नई योजना जोड़ें
                </button>
              </div>

              {/* Correction Reason */}
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-secondary">सुधार क्षेत्र</p>
                <textarea 
                  className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-white border-opacity-20 bg-white bg-opacity-5 p-4 text-base font-normal leading-normal text-primary placeholder:text-muted focus:border-mint-green focus:ring-2 focus:ring-mint-green focus:ring-opacity-50 min-h-36"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="सुधार का कारण दर्ज करें..."
                />
              </label>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex w-full max-w-2xl flex-wrap items-center justify-center gap-4">
          <button 
            onClick={handleSkip}
            className="group flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white border-opacity-20 bg-white bg-opacity-5 text-secondary transition-all hover:scale-105 hover:bg-opacity-10 hover:text-primary"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowAIAssistant(true)}
            className="group flex h-14 flex-shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-base font-bold text-primary shadow-lg transition-all hover:scale-105 bg-mint-green bg-opacity-20 border border-mint-green border-opacity-40 hover:bg-opacity-30"
          >
            <Edit className="w-5 h-5" />
            <span>संपादित करें</span>
          </button>
          <button 
            onClick={handleApprove}
            className="group flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-base font-bold text-primary shadow-lg transition-all hover:scale-105 bg-status-approved bg-opacity-20 border border-status-approved border-opacity-40 hover:bg-opacity-30"
          >
            <Check className="w-5 h-5" />
            <span>अनुमोदन करें</span>
          </button>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between w-full max-w-2xl">
          <button 
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-secondary bg-white bg-opacity-5 border border-white border-opacity-20 hover:bg-opacity-10 transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <h3 className="text-primary text-lg font-bold leading-tight tracking-[-0.015em]">
            Tweet {currentIndex + 1} of {tweets.length}
          </h3>
          <button 
            onClick={() => setCurrentIndex(Math.min(tweets.length - 1, currentIndex + 1))}
            disabled={currentIndex === tweets.length - 1}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-secondary bg-white bg-opacity-5 border border-white border-opacity-20 hover:bg-opacity-10 transition-colors disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>


      {/* AI Assistant Modal */}
      <AIAssistantModal 
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        currentTweet={currentTweet}
        onSend={handleAISend}
        messages={aiMessages}
        setMessages={setAiMessages}
      />
    </div>
  );
}
