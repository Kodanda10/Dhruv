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
  console.log('ReviewQueueNew: Component mounting...');
  
  // Temporarily use static data to get Review working
  const staticTweets = [
    {
      id: 1,
      tweet_id: "1979023456789012345",
      event_type: "बैठक",
      event_date: "2025-10-17T02:30:15.000Z",
      locations: ["बिलासपुर"],
      people_mentioned: [],
      organizations: [],
      schemes_mentioned: ["युवा उद्यमिता कार्यक्रम"],
      overall_confidence: "0.85",
      needs_review: true,
      review_status: "pending",
      parsed_at: "2025-10-17T02:30:15.000Z",
      parsed_by: "system"
    },
    {
      id: 2,
      tweet_id: "1979023456789012346",
      event_type: "रैली",
      event_date: "2025-10-16T15:45:30.000Z",
      locations: ["रायगढ़"],
      people_mentioned: ["मुख्यमंत्री"],
      organizations: ["भाजपा"],
      schemes_mentioned: ["मुख्यमंत्री किसान योजना"],
      overall_confidence: "0.90",
      needs_review: true,
      review_status: "pending",
      parsed_at: "2025-10-16T15:45:30.000Z",
      parsed_by: "system"
    }
  ];
  
  const [tweets, setTweets] = useState(staticTweets);
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
  const [loading, setLoading] = useState(false); // Set to false since we're using static data

  // Add autocomplete for schemes/events
  const [schemeSuggestions, setSchemeSuggestions] = useState<any[]>([]);
  const [eventSuggestions, setEventSuggestions] = useState<any[]>([]);
  const [showSchemeSuggestions, setShowSchemeSuggestions] = useState(false);
  const [showEventSuggestions, setShowEventSuggestions] = useState(false);

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
      console.error('Error fetching suggestions:', error);
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
      console.error('Error saving new value:', error);
      alert('नया मान सहेजने में त्रुटि हुई');
    }
  };

  // Fetch tweets from API on component mount
  useEffect(() => {
    console.log('ReviewQueueNew: useEffect triggered');
    
    // Temporarily use static data to get Review working
    const staticTweets = [
      {
        id: 1,
        tweet_id: "1979023456789012345",
        event_type: "बैठक",
        event_date: "2025-10-17T02:30:15.000Z",
        locations: ["बिलासपुर"],
        people_mentioned: [],
        organizations: [],
        schemes_mentioned: ["युवा उद्यमिता कार्यक्रम"],
        overall_confidence: "0.85",
        needs_review: true,
        review_status: "pending",
        parsed_at: "2025-10-17T02:30:15.000Z",
        parsed_by: "system"
      },
      {
        id: 2,
        tweet_id: "1979023456789012346",
        event_type: "रैली",
        event_date: "2025-10-16T15:45:30.000Z",
        locations: ["रायगढ़"],
        people_mentioned: ["मुख्यमंत्री"],
        organizations: ["भाजपा"],
        schemes_mentioned: ["मुख्यमंत्री किसान योजना"],
        overall_confidence: "0.90",
        needs_review: true,
        review_status: "pending",
        parsed_at: "2025-10-16T15:45:30.000Z",
        parsed_by: "system"
      }
    ];
    
    console.log('ReviewQueueNew: Using static data, count:', staticTweets.length);
    setTweets(staticTweets);
    setLoading(false);
    
    // Original API call (commented out due to useEffect issue)
    /*
    const fetchTweets = async () => {
      try {
        console.log('ReviewQueueNew: Starting to fetch tweets...');
        setLoading(true);
        const response = await fetch('/api/parsed-events?limit=200');
        console.log('ReviewQueueNew: Response status:', response.status);
        const result = await response.json();
        console.log('ReviewQueueNew: API result:', result);
        
        if (result.success && result.data) {
          console.log('ReviewQueueNew: Setting tweets, count:', result.data.length);
          setTweets(result.data);
        } else {
          console.error('Failed to fetch tweets:', result.error);
        }
      } catch (error) {
        console.error('Error fetching tweets:', error);
      } finally {
        console.log('ReviewQueueNew: Setting loading to false');
        setLoading(false);
      }
    };

    fetchTweets();
    */
  }, []);

  const currentTweet = tweets[currentIndex];
  
  console.log('ReviewQueueNew: tweets length:', tweets.length);
  console.log('ReviewQueueNew: currentIndex:', currentIndex);
  console.log('ReviewQueueNew: currentTweet:', currentTweet);
  
  const stats = useMemo(() => {
    const pending = tweets.filter(t => t.review_status !== 'approved').length;
    const reviewed = tweets.filter(t => t.review_status === 'approved').length;
    const avgConfidence = tweets.reduce((sum, t) => sum + (t.confidence || 0), 0) / tweets.length;
    
    console.log('ReviewQueueNew: stats calculated:', { pending, reviewed, avgConfidence });
    return { pending, reviewed, avgConfidence };
  }, [tweets]);

  const handleEdit = () => {
    if (!currentTweet) return;
    
    setEditMode(true);
    setEditedData({
      event_type: currentTweet.parsed?.event_type || 'other',
      locations: currentTweet.parsed?.locations?.map((l: any) => l.name || l) || [],
      people: currentTweet.parsed?.people || [],
      organizations: currentTweet.parsed?.organizations || [],
      schemes: currentTweet.parsed?.schemes || [],
    });
    setCorrectionReason('');
  };

  const handleSave = async () => {
    if (!currentTweet || !correctionReason.trim()) {
      alert('कृपया सुधार का कारण दर्ज करें (Please enter correction reason)');
      return;
    }
    
    setEditMode(false);
    setCorrectionReason('');
  };

  const handleApprove = async () => {
    if (!currentTweet) return;
    
    try {
      // Update via API
      const response = await fetch('/api/parsed-events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: currentTweet.id,
          updates: {
            review_status: 'approved',
            needs_review: false
          }
        })
      });

      if (response.ok) {
        // Update local state
        const updatedTweets = [...tweets];
        updatedTweets[currentIndex] = {
          ...currentTweet,
          review_status: 'approved',
          needs_review: false
        };
        setTweets(updatedTweets);
        
        // Move to next tweet
        if (currentIndex < tweets.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
        
        console.log('✅ Tweet approved successfully');
      } else {
        console.error('❌ Failed to approve tweet');
        alert('ट्वीट को अनुमोदित करने में त्रुटि हुई। कृपया पुनः प्रयास करें।');
      }
    } catch (error) {
      console.error('Error approving tweet:', error);
      alert('ट्वीट को अनुमोदित करने में त्रुटि हुई। कृपया पुनः प्रयास करें।');
    }
  };

  const handleSkip = async () => {
    if (!currentTweet) return;
    setTweets(prev => prev.filter((_, idx) => idx !== currentIndex));
  };

  const handleAISend = () => {
    if (!aiInput.trim()) return;
    
    const newMessage = {
      type: 'user',
      content: aiInput,
      suggestions: []
    };
    
    setAiMessages(prev => [...prev, newMessage]);
    setAiInput('');
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        type: 'ai',
        content: 'समझ गया। मैंने आपके अनुरोध के अनुसार अपडेट कर दिया है। क्या आप कुछ और बदलना चाहेंगे?',
        suggestions: ['अन्य फ़ील्ड की समीक्षा करें', 'नए टैग सुझाएं']
      };
      setAiMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const addTag = (tag: string) => {
    setTags(prev => [...prev, tag]);
    setAvailableTags(prev => prev.filter(t => t !== tag));
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
    setAvailableTags(prev => [...prev, tag]);
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">समीक्षा डेटा लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

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
          <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4">
            <p className="text-sm font-medium text-gray-400">समीक्षा के लिए</p>
            <p className="text-2xl font-bold text-white">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4">
            <p className="text-sm font-medium text-gray-400">समीक्षित</p>
            <p className="text-2xl font-bold text-white">{stats.reviewed}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-4">
            <p className="text-sm font-medium text-gray-400">औसत विश्वास</p>
            <p className="text-2xl font-bold text-white">{Math.round(stats.avgConfidence * 100)}%</p>
          </div>
        </div>

        {/* Tweet Counter */}
        <p className="mb-4 text-center text-sm font-normal leading-normal text-gray-400">
          ट्वीट {currentIndex + 1} में से {tweets.length}
        </p>

        {/* Tweet Card */}
        <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-[#0d1117] p-6 shadow-2xl sm:p-8">
          {/* Tweet Header */}
          <div className="flex items-center gap-4">
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-14 w-14" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBNUkxYhQdfbK8RN72N4PUjwW9vbF4OPsUCu8LobAyWyBt0-Ty5BwoXr_Zp6AoaCFf1atiW5TAxUDhxgZR2zLoaElzlAQ_-V7fFo3dALshVsdy_OuJ8XzvwZG_InS1k30-fso8zRKyULYzJ1x84QjNc09mU1Yr2uqnFbOrUxpcZgztKSyRZ1HmTlJTfjSze8Wqs47Y9wUHzhVlxv1VpJvJn_0vM1jZe4kXyWcSxcsCUWpZaHwzIMCl3jx38C-zfTzwTLGUuQXAQeF13")'}}></div>
            <div className="flex flex-col justify-center">
              <p className="text-lg font-medium leading-normal text-gray-100 line-clamp-1">Tweet #{currentTweet.id}</p>
              <p className="text-sm font-normal leading-normal text-gray-400 line-clamp-2">{formatDate(currentTweet.timestamp)}</p>
            </div>
            <div className="ml-auto flex items-center gap-2 p-2 rounded-lg bg-green-900/50">
              <Check className="w-4 h-4 text-green-400" />
              <p className="text-base font-bold text-green-300">{Math.round(confidence * 100)}% विश्वास</p>
            </div>
          </div>

          <hr className="my-6 border-gray-700" />

          {/* Tweet Content */}
          <p className="text-lg font-normal leading-relaxed text-gray-200">
            {tweetText}
          </p>

          {/* Parsed Data */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">घटना प्रकार</p>
              <p className="font-semibold text-gray-200">{getEventTypeHindi(currentTweet.parsed?.event_type) || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">स्थान</p>
              <p className="font-semibold text-gray-200">{(currentTweet.parsed?.locations || []).map((l: any) => l.name || l).join(', ') || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">लोग</p>
              <p className="font-semibold text-gray-200">{(currentTweet.parsed?.people || []).join(', ') || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">संगठन</p>
              <p className="font-semibold text-gray-200">{(currentTweet.parsed?.organizations || []).join(', ') || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400 mb-1">योजनाएं</p>
              <p className="font-semibold text-gray-200">{(currentTweet.parsed?.schemes || []).join(', ') || '—'}</p>
            </div>
          </div>

          {/* Edit Mode */}
          {editMode && (
            <div className="mt-6 flex flex-col space-y-4">
              {/* Event Type with Autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">घटना प्रकार</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-700 bg-[#0d1117] p-3 text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                  placeholder="घटना प्रकार खोजें..."
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
                  <div className="absolute z-10 w-full mt-1 bg-[#0d1117] border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {eventSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-3 hover:bg-gray-800 cursor-pointer text-gray-200 border-b border-gray-700 last:border-b-0"
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
                <label className="block text-sm font-medium text-gray-300 mb-2">योजनाएं</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-700 bg-[#0d1117] p-3 text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
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
                  <div className="absolute z-10 w-full mt-1 bg-[#0d1117] border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {schemeSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-3 hover:bg-gray-800 cursor-pointer text-gray-200 border-b border-gray-700 last:border-b-0"
                        onClick={() => {
                          setEditedData({...editedData, schemes: suggestion.name_hi});
                          setShowSchemeSuggestions(false);
                        }}
                      >
                        <div className="font-medium">{suggestion.name_hi}</div>
                        <div className="text-sm text-gray-400">{suggestion.name_en} ({suggestion.category})</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Value Button */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newEventType = prompt('नया घटना प्रकार (हिंदी):');
                    const newEventTypeEn = prompt('नया घटना प्रकार (अंग्रेजी):');
                    if (newEventType) {
                      handleAddNewValue('event_type', newEventType, newEventTypeEn);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  नया घटना प्रकार जोड़ें
                </button>
                <button
                  onClick={() => {
                    const newScheme = prompt('नई योजना (हिंदी):');
                    const newSchemeEn = prompt('नई योजना (अंग्रेजी):');
                    if (newScheme) {
                      handleAddNewValue('scheme', newScheme, newSchemeEn);
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
                <p className="pb-2 text-sm font-medium leading-normal text-gray-300">सुधार क्षेत्र</p>
                <textarea 
                  className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-gray-700 bg-[#0d1117] p-4 text-base font-normal leading-normal text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 min-h-36"
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
            className="group flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-[#0d1117] text-gray-300 transition-all hover:scale-105 hover:bg-gray-800 hover:text-white"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowAIAssistant(true)}
            className="group flex h-14 flex-shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-base font-bold text-white shadow-lg transition-all hover:scale-105 bg-blue-600 hover:bg-blue-700"
          >
            <Edit className="w-5 h-5" />
            <span>संपादित करें</span>
          </button>
          <button 
            onClick={handleApprove}
            className="group flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-base font-bold text-white shadow-lg transition-all hover:scale-105 bg-green-600 hover:bg-green-700"
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
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <h3 className="text-gray-200 text-lg font-bold leading-tight tracking-[-0.015em]">
            Tweet {currentIndex + 1} of {tweets.length}
          </h3>
          <button 
            onClick={() => setCurrentIndex(Math.min(tweets.length - 1, currentIndex + 1))}
            disabled={currentIndex === tweets.length - 1}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Assistant Modal */}
      {showAIAssistant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-xl shadow-2xl bg-[#192734] text-gray-100 flex max-h-[90vh] overflow-hidden">
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Brain className="w-6 h-6 text-[#13a4ec]" />
                  विशेषज्ञ संपादक AI सहायक
                </h2>
                <button 
                  onClick={() => setShowAIAssistant(false)}
                  className="p-1 rounded-full hover:bg-gray-800 transition-colors"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 overflow-y-auto flex flex-col-reverse flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input 
                      className="w-full rounded-full border-gray-700 bg-gray-800 focus:ring-[#13a4ec] focus:border-[#13a4ec] text-gray-100 py-2 px-4"
                      placeholder="अपनी प्रतिक्रिया टाइप करें..."
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAISend()}
                    />
                  </div>
                  <button 
                    onClick={handleAISend}
                    className="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white bg-[#13a4ec] hover:bg-[#13a4ec]/90 transition-colors h-10 w-10 flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-4 flex flex-col">
                  {aiMessages.map((message, index) => (
                    <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 rounded-lg max-w-xs md:max-w-md ${
                        message.type === 'user' 
                          ? 'bg-[#13a4ec]/20 text-blue-300' 
                          : 'bg-gray-800 text-gray-200'
                      }`}>
                        {message.content}
                        {message.suggestions && (
                          <div className="mt-2 flex flex-wrap gap-2 text-sm">
                            {message.suggestions.map((suggestion, i) => (
                              <span 
                                key={i}
                                className="bg-gray-700 text-gray-300 px-2 py-1 rounded-full cursor-pointer hover:bg-gray-600"
                              >
                                {suggestion}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-6 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-400">ट्वीट {currentIndex + 1} में से {tweets.length}</span>
                  <button className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">रद्द करें</button>
                  <button className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">सहेजें</button>
                  <button className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[#13a4ec] hover:bg-[#13a4ec]/90 transition-colors">सहेजें और स्वीकृत करें</button>
                </div>
              </div>
            </div>
            
            {/* Sidebar */}
            <div className="w-full md:w-2/5 border-l border-gray-800 flex flex-col p-6 overflow-y-auto bg-gray-900">
              <h3 className="text-lg font-bold text-gray-100 mb-4">ट्वीट विवरण</h3>
              <div className="space-y-4 text-sm">
                <p className="text-gray-400">ट्वीट आईडी: <span className="text-gray-200 font-mono">{currentTweet.id}</span></p>
                <p className="text-gray-400">समय: <span className="text-gray-200">{formatDate(currentTweet.timestamp)}</span></p>
                <div className="p-2 rounded-lg bg-green-900/50 flex items-center gap-2 w-fit">
                  <Check className="w-4 h-4 text-green-400" />
                  <p className="text-sm font-bold text-green-300">{Math.round(confidence * 100)}% विश्वास</p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                  <p className="text-gray-200 leading-relaxed text-sm">{tweetText}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">कार्यक्रम का प्रकार</p>
                    <p className="font-semibold text-gray-200">{getEventTypeHindi(currentTweet.parsed?.event_type) || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">स्थान</p>
                    <p className="font-semibold text-gray-200">{(currentTweet.parsed?.locations || []).map((l: any) => l.name || l).join(', ') || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">लोग</p>
                    <p className="font-semibold text-gray-200">{(currentTweet.parsed?.people || []).join(', ') || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">संगठन</p>
                    <p className="font-semibold text-gray-200">{(currentTweet.parsed?.organizations || []).join(', ') || '—'}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-bold text-gray-100 mb-2">जोड़े गए टैग</p>
                  <div className="relative mb-3">
                    <div className="relative">
                      <input 
                        className="w-full rounded-md border-gray-700 bg-gray-800 focus:ring-[#13a4ec] focus:border-[#13a4ec] text-gray-100 py-2 pl-10 pr-4 text-sm"
                        placeholder="टैग, स्थान, या लोग खोजें..."
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[6rem] p-3 border border-gray-700 rounded-md bg-gray-800 relative">
                    {tags.map((tag, index) => (
                      <span key={index} className="flex items-center gap-1 bg-[#13a4ec]/20 text-blue-300 px-2 py-1 rounded-full text-xs cursor-grab hover:bg-[#13a4ec]/30 active:cursor-grabbing" draggable="true">
                        {tag}
                        <button 
                          onClick={() => removeTag(tag)}
                          className="text-blue-300 hover:text-blue-100 ml-1"
                        >
                          <CloseIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {availableTags.map((tag, index) => (
                      <span key={index} className="flex items-center gap-1 bg-gray-700 text-gray-300 px-2 py-1 rounded-full text-xs cursor-grab hover:bg-gray-600 active:cursor-grabbing" draggable="true">
                        {tag}
                        <button 
                          onClick={() => addTag(tag)}
                          className="text-gray-400 hover:text-gray-100 ml-1"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <div className="absolute bottom-3 right-3 p-2 rounded-full bg-red-800/50 text-red-300 border border-red-700 hover:bg-red-700/50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 flex items-center justify-center size-8">
                      <Trash2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      <AIAssistantModal 
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        currentTweet={currentTweet}
      />
    </div>
  );
}
