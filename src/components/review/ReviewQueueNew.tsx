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

// Real data from deployment
const parsedTweets = [
  {
    "id": "1979087135895621683",
    "timestamp": "2025-10-17T07:28:37",
    "content": "अंतागढ़ विधानसभा के लोकप्रिय विधायक एवं छत्तीसगढ़ भाजपा के पूर्व अध्यक्ष माननीय श्री विक्रम उसेंडी जी को जन्मदिन की हार्दिक बधाई एवं शुभकामनायें।\nप्रभु श्रीराम जी से आपके उत्तम स्वास्थ्य एवं दीर्घायु जीवन की कामना करता हूं।\n\n@VikramUsendi https://t.co/YroOSRmZhO",
    "parsed": {
      "event_type": "birthday_wishes",
      "event_date": "2025-10-17",
      "locations": [
        {
          "name": "छत्तीसगढ़",
          "confidence": 0.8
        },
        {
          "name": "अंतागढ़",
          "confidence": 0.8
        }
      ],
      "people": [
        "विक्रम उसेंडी जी को"
      ],
      "organizations": [
        "भाजपा"
      ],
      "schemes": []
    },
    "confidence": 0.78,
    "needs_review": false,
    "review_status": "pending"
  },
  {
    "id": "1979074268907606480",
    "timestamp": "2025-10-17T06:37:29",
    "content": "यह दीपावली उन लाखों परिवारों के लिए खास होने वाली है, जिनके पास कभी अपना घर नहीं था। इस बार उनके द्वार पर पहली बार रंगोली सजेगी, दीवारों पर झालरें टंगेगी और आंगन दीपों की ज्योति से जगमगाएंगे। प्रधानमंत्री आवास योजना से इन परिवारों को केवल एक घर ही नहीं, बल्कि गरिमा, सम्मान और https://t.co/PKHyYhNv8v",
    "parsed": {
      "event_type": "scheme_announcement",
      "event_date": "2025-10-17",
      "locations": [],
      "people": [],
      "organizations": [],
      "schemes": [
        "प्रधानमंत्री आवास योजना"
      ]
    },
    "confidence": 0.55,
    "needs_review": true,
    "review_status": "pending"
  },
  {
    "id": "1979049036633010349",
    "timestamp": "2025-10-17T05:15:42",
    "content": "रायपुर में आज मुख्यमंत्री श्री भूपेश बघेल जी ने नई शिक्षा नीति के तहत स्कूलों में डिजिटल क्लासरूम का उद्घाटन किया। इस अवसर पर शिक्षा मंत्री श्री प्रेमसाय सिंह टेकाम जी भी उपस्थित रहे।",
    "parsed": {
      "event_type": "inauguration",
      "event_date": "2025-10-17",
      "locations": [
        {
          "name": "रायपुर",
          "confidence": 0.9
        }
      ],
      "people": [
        "भूपेश बघेल",
        "प्रेमसाय सिंह टेकाम"
      ],
      "organizations": [
        "छत्तीसगढ़ सरकार"
      ],
      "schemes": [
        "नई शिक्षा नीति"
      ]
    },
    "confidence": 0.85,
    "needs_review": false,
    "review_status": "approved"
  }
];

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
  const [tweets, setTweets] = useState(parsedTweets);
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
    
    const updatedTweets = [...tweets];
    updatedTweets[currentIndex] = {
      ...currentTweet,
      review_status: 'approved',
    };
    setTweets(updatedTweets);
  };

  const handleSkip = async () => {
    if (!currentTweet) return;
    setTweets(prev => prev.filter((_, idx) => idx !== currentIndex));
  };

  const handleAISend = () => {
    if (!aiInput.trim()) return;
    
    const newMessage = {
      type: 'user',
      content: aiInput
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

  const tweetText = currentTweet.content || '';
  const confidence = currentTweet.confidence || 0;

  return (
    <div className="min-h-screen bg-[#0A0128] text-neutral-200 antialiased">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 h-full w-full">
        <div className="absolute bottom-[-10%] left-[-20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(44,0,95,0.7),rgba(255,255,255,0))]"></div>
        <div className="absolute right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(0,75,79,0.6),rgba(255,255,255,0))]"></div>
      </div>

      {/* Header */}
      <header className="fixed top-4 z-10 flex w-full max-w-5xl items-center justify-between whitespace-nowrap rounded-xl border border-white/10 bg-white/[.07] px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-4 text-white">
          <span className="text-[#13a4ec]" style={{fontSize: '28px'}}>insights</span>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-neutral-100">विश्लेषिकी</h2>
        </div>
        <div className="hidden flex-1 items-center justify-center gap-9 md:flex">
          <a className="text-sm font-medium leading-normal text-neutral-200 transition-colors hover:text-white" href="#">डैशबोर्ड</a>
          <a className="text-sm font-bold leading-normal text-white" href="#">कतार</a>
          <a className="text-sm font-medium leading-normal text-neutral-200 transition-colors hover:text-white" href="#">सेटिंग्स</a>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-white/10 text-neutral-200 transition-colors hover:bg-white/20 hover:text-white">
            <Bell className="w-5 h-5" />
          </button>
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAhYH5Ti7sDpYdKLVf3b7esJKZpRiG8yJMxp7MbH1N-xnz5k-eM_pp-L36c_GpPeQE6ugwcueHXc_zt6CBtKPcAkqjvgFtCyqiOEhZCjgcpw3XjP3eY4yw5yBGERv2QOb9qgoqb9g1HCrEy5yFRYxihrqmpGHK5tMgvmG6SAAkisLgkU7zCa8qmpYBE8alnQe4HkWbOsI7ArSvQ4H20u6XKAhAIA4XKm2iyKdMT3D1-ubvOY5IFHvsMZa64qElvzXozw1YiiDJCM53R")'}}></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex w-full flex-1 flex-col items-center px-4 pt-32 pb-16">
        {/* Stats Cards */}
        <div className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[.02] p-4 backdrop-blur-lg">
            <p className="text-sm font-medium text-neutral-400">समीक्षा के लिए</p>
            <p className="text-2xl font-bold text-white">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[.02] p-4 backdrop-blur-lg">
            <p className="text-sm font-medium text-neutral-400">समीक्षित</p>
            <p className="text-2xl font-bold text-white">{stats.reviewed}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[.02] p-4 backdrop-blur-lg">
            <p className="text-sm font-medium text-neutral-400">औसत विश्वास</p>
            <p className="text-2xl font-bold text-white">{Math.round(stats.avgConfidence * 100)}%</p>
          </div>
        </div>

        {/* Tweet Counter */}
        <p className="mb-4 text-center text-sm font-normal leading-normal text-neutral-400">
          ट्वीट {currentIndex + 1} में से {tweets.length}
        </p>

        {/* Tweet Card */}
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[.07] p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          {/* Tweet Header */}
          <div className="flex items-center gap-4">
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-14 w-14" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBNUkxYhQdfbK8RN72N4PUjwW9vbF4OPsUCu8LobAyWyBt0-Ty5BwoXr_Zp6AoaCFf1atiW5TAxUDhxgZR2zLoaElzlAQ_-V7fFo3dALshVsdy_OuJ8XzvwZG_InS1k30-fso8zRKyULYzJ1x84QjNc09mU1Yr2uqnFbOrUxpcZgztKSyRZ1HmTlJTfjSze8Wqs47Y9wUHzhVlxv1VpJvJn_0vM1jZe4kXyWcSxcsCUWpZaHwzIMCl3jx38C-zfTzwTLGUuQXAQeF13")'}}></div>
            <div className="flex flex-col justify-center">
              <p className="text-lg font-medium leading-normal text-neutral-100 line-clamp-1">Tweet #{currentTweet.id}</p>
              <p className="text-sm font-normal leading-normal text-neutral-400 line-clamp-2">{formatDate(currentTweet.timestamp)}</p>
            </div>
            <div className="ml-auto flex items-center gap-2 p-2 rounded-lg bg-green-900/50">
              <Check className="w-4 h-4 text-green-400" />
              <p className="text-base font-bold text-green-300">{Math.round(confidence * 100)}% विश्वास</p>
            </div>
          </div>

          <hr className="my-6 border-white/10" />

          {/* Tweet Content */}
          <p className="text-lg font-normal leading-relaxed text-neutral-200">
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
            <div className="mt-6 flex flex-col">
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-neutral-300">सुधार क्षेत्र</p>
                <textarea 
                  className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-white/10 bg-black/20 p-4 text-base font-normal leading-normal text-neutral-200 placeholder:text-neutral-500 focus:border-[#13a4ec] focus:ring-1 focus:ring-[#13a4ec]/50 min-h-36"
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
            className="group flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[.07] text-neutral-300 transition-all hover:scale-105 hover:bg-white/20 hover:text-white"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowAIAssistant(true)}
            className="group flex h-14 flex-shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-base font-bold text-white shadow-lg transition-all hover:scale-105"
            style={{backgroundColor: '#4d8bff', boxShadow: '0 0 20px rgba(77, 139, 255, 0.5)'}}
          >
            <Edit className="w-5 h-5" />
            <span>संपादित करें</span>
          </button>
          <button 
            onClick={handleApprove}
            className="group flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-base font-bold text-black shadow-lg transition-all hover:scale-105"
            style={{backgroundColor: '#00ffa3', boxShadow: '0 0 20px rgba(0, 255, 163, 0.5)'}}
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
      </main>

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
