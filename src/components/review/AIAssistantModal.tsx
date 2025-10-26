'use client';
import React, { useState } from 'react';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTweet: any;
}

export default function AIAssistantModal({ isOpen, onClose, currentTweet }: AIAssistantModalProps) {
  const [aiInput, setAiInput] = useState('');
  const [messages, setMessages] = useState([
    {
      type: 'user',
      content: 'मैं \'हरित अवसंरचना\' (Green Infrastructure) को एक और टैग के रूप में जोड़ना चाहूँगा।'
    },
    {
      type: 'ai',
      content: 'उत्कृष्ट! "हरित अवसंरचना" टैग जोड़ दिया गया है। क्या आप कुछ और बदलना चाहेंगे?',
      suggestions: ['अन्य फ़ील्ड की समीक्षा करें', 'नए टैग सुझाएं']
    },
    {
      type: 'user',
      content: 'कार्यक्रम का प्रकार एक \'कार्यशाला\' (Workshop) है।'
    },
    {
      type: 'ai',
      content: 'समझ गया। मैंने \'कार्यक्रम का प्रकार\' को "कार्यशाला" में अपडेट कर दिया है। अब स्थान क्या है?'
    },
    {
      type: 'ai',
      content: 'नमस्कार! मैं आपका AI सहायक हूँ, जो इस ट्वीट के विवरण को परिष्कृत करने में आपकी सहायता करेगा।',
      suggestions: ['कार्यक्रम का प्रकार सेट करें', 'स्थान जोड़ें', 'टैग सुझाएं']
    }
  ]);
  const [tags, setTags] = useState([
    { name: 'शहरी विकास', active: true },
    { name: 'हरित अवसंरचना', active: true },
    { name: 'स्थिरता', active: true },
    { name: 'शहरी नियोजन', active: true },
    { name: 'सार्वजनिक स्थान', active: false },
    { name: 'सामुदायिक जुड़ाव', active: false }
  ]);

  const handleSend = async () => {
    if (!aiInput.trim()) return;

    const newMessage = {
      type: 'user',
      content: aiInput
    };

    setMessages(prev => [...prev, newMessage]);
    const userInput = aiInput;
    setAiInput('');

    // Add loading message
    const loadingMessage = {
      type: 'ai',
      content: 'सोच रहा हूँ...',
      suggestions: []
    };
    setMessages(prev => [...prev, loadingMessage]);

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
      setMessages(prev => prev.slice(0, -1));
      
      if (data.success) {
        const aiResponse = {
          type: 'ai',
          content: data.response,
          suggestions: ['अन्य फ़ील्ड की समीक्षा करें', 'नए टैग सुझाएं', 'स्थान जोड़ें']
        };
        setMessages(prev => [...prev, aiResponse]);
      } else {
        throw new Error(data.error || 'AI Assistant error');
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      // Remove loading message
      setMessages(prev => prev.slice(0, -1));
      
      const errorResponse = {
        type: 'ai',
        content: 'क्षमा करें, मैं इस समय आपकी सहायता नहीं कर सकता। कृपया बाद में पुनः प्रयास करें।',
        suggestions: ['पुनः प्रयास करें']
      };
      setMessages(prev => [...prev, errorResponse]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setAiInput(suggestion);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl rounded-xl shadow-2xl bg-[#192734] text-gray-100 flex max-h-[90vh] overflow-hidden">
        {/* Left Panel: AI Chat */}
        <div className="flex flex-col flex-1 bg-[#192734] border-r border-gray-800">
          <header className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">psychology</span>
              विशेषज्ञ संपादक AI सहायक
            </h2>
            <button 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-800 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>
          
          <main className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col-reverse">
            <div className="flex items-center gap-3">
              <input 
                type="text" 
                className="form-input w-full rounded-full border-gray-700 bg-gray-800 text-gray-100 py-2 px-4" 
                placeholder="अपनी प्रतिक्रिया टाइप करें..." 
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={handleSend}
                className="rounded-full bg-blue-600 hover:bg-blue-700 h-10 w-10 flex items-center justify-center"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
            
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-lg max-w-md ${
                    message.type === 'user' 
                      ? 'bg-blue-900/40 text-blue-300' 
                      : 'bg-gray-800'
                  }`}>
                    {message.content}
                           {message.suggestions && (
                             <div className="mt-2 flex gap-2 text-sm">
                               {message.suggestions.map((suggestion, i) => (
                                 <button
                                   key={i}
                                   onClick={() => handleSuggestionClick(suggestion)}
                                   className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-full cursor-pointer"
                                 >
                                   {suggestion}
                                 </button>
                               ))}
                             </div>
                           )}
                  </div>
                </div>
              ))}
            </div>
          </main>
          
          <footer className="p-4 border-t border-gray-800 flex justify-between">
            <div className="text-sm text-gray-400">ट्वीट 1 में से 53</div>
            <div className="flex gap-2">
              <button className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">रद्द करें</button>
              <button className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">सहेजें</button>
              <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">सहेजें और स्वीकृत करें</button>
            </div>
          </footer>
        </div>

        {/* Right Panel: Tweet Details */}
        <div className="w-full md:w-2/5 bg-[#0d1117] p-6 overflow-y-auto">
          <h3 className="text-lg font-bold text-gray-100 mb-4">ट्वीट विवरण</h3>
          <p className="text-gray-400 text-sm mb-1">ट्वीट आईडी: <span className="text-gray-200 font-mono">{currentTweet?.id || '1706013219808358808'}</span></p>
          <p className="text-gray-400 text-sm mb-3">समय: <span className="text-gray-200">{currentTweet ? new Date(currentTweet.timestamp).toLocaleString('hi-IN') : '24 सितंबर 2023, रात 08:30'}</span></p>
          <div className="flex items-center gap-2 bg-green-900/50 w-fit px-2 py-1 rounded-lg mb-4">
            <span className="material-symbols-outlined text-green-400 text-sm">verified</span>
            <p className="text-green-300 text-sm font-semibold">{currentTweet ? Math.round((currentTweet.confidence || 0) * 100) : 95}% विश्वास</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg mb-4">
            <p className="text-gray-200 text-sm leading-relaxed">
              {currentTweet?.content || 'Just attended an incredible workshop on sustainable urban development. So many innovative ideas for creating greener, more livable cities. Feeling inspired to make a change in my community!'}
              <a href="#" className="text-blue-400 hover:underline">#Sustainability #UrbanPlanning</a>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
            <div><p className="text-gray-400">कार्यक्रम का प्रकार:</p><p className="text-gray-200 font-semibold">कार्यशाला</p></div>
            <div><p className="text-gray-400">स्थान:</p><p className="text-gray-200 font-semibold">—</p></div>
            <div><p className="text-gray-400">लोग:</p><p className="text-gray-200 font-semibold">—</p></div>
            <div><p className="text-gray-400">संगठन:</p><p className="text-gray-200 font-semibold">—</p></div>
          </div>
          <div>
            <p className="text-gray-300 font-bold text-sm mb-2">जोड़े गए टैग</p>
            <input 
              type="text" 
              placeholder="टैग, स्थान, या लोग खोजें..." 
              className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 mb-3 text-sm text-gray-100" 
            />
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span 
                  key={index}
                  className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                    tag.active 
                      ? 'bg-blue-900/30 text-blue-300' 
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {tag.name}
                  <button 
                    onClick={() => toggleTag(tag.name)}
                    className="material-symbols-outlined text-xs"
                  >
                    {tag.active ? 'close' : 'add'}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
