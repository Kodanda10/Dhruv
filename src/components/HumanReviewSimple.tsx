"use client";
import parsedTweets from '../../data/parsed_tweets.json';
import { useState } from 'react';
import Card from './Card';
import SoftButton from './SoftButton';

type ParsedTweet = {
  id: string;
  timestamp: string;
  content: string;
  parsed: {
    event_type: string;
    locations: any[];
    people: string[];
    organizations: string[];
    schemes: string[];
  };
  confidence: number;
  needs_review: boolean;
  review_status: string;
};

export default function HumanReviewSimple() {
  const [tweets, setTweets] = useState<ParsedTweet[]>(parsedTweets as ParsedTweet[]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const handleEdit = (tweet: ParsedTweet) => {
    setEditingId(tweet.id);
    setEditForm({
      event_type: tweet.parsed.event_type,
      locations: tweet.parsed.locations?.map((l: any) => l.name || l).join(', ') || '',
      people: tweet.parsed.people?.join(', ') || '',
      organizations: tweet.parsed.organizations?.join(', ') || '',
      schemes: tweet.parsed.schemes?.join(', ') || '',
    });
  };

  const handleSave = async (tweetId: string) => {
    // TODO: Send to API to save corrections
    // console.log('Saving corrections for tweet:', tweetId, editForm);
    
    // Update local state
    setTweets(tweets.map(t => {
      if (t.id === tweetId) {
        return {
          ...t,
          parsed: {
            ...t.parsed,
            event_type: editForm.event_type,
            locations: editForm.locations.split(',').map((s: string) => s.trim()).filter(Boolean),
            people: editForm.people.split(',').map((s: string) => s.trim()).filter(Boolean),
            organizations: editForm.organizations.split(',').map((s: string) => s.trim()).filter(Boolean),
            schemes: editForm.schemes.split(',').map((s: string) => s.trim()).filter(Boolean),
          },
          review_status: 'edited',
        };
      }
      return t;
    }));
    
    setEditingId(null);
    alert('✅ सुधार सहेजा गया! (Corrections saved!)');
  };

  const handleApprove = (tweetId: string) => {
    setTweets(tweets.map(t => t.id === tweetId ? { ...t, review_status: 'approved' } : t));
    alert('✅ स्वीकृत! (Approved!)');
  };

  const handleReject = (tweetId: string) => {
    setTweets(tweets.map(t => t.id === tweetId ? { ...t, review_status: 'rejected' } : t));
    alert('❌ अस्वीकृत! (Rejected!)');
  };

  const pendingTweets = tweets.filter(t => t.review_status === 'pending' || t.needs_review);
  const reviewedTweets = tweets.filter(t => ['approved', 'rejected', 'edited'].includes(t.review_status));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-cyan-300">{pendingTweets.length}</div>
          <div className="text-sm text-teal-200">समीक्षा के लिए (Pending)</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-300">{reviewedTweets.length}</div>
          <div className="text-sm text-teal-200">समीक्षित (Reviewed)</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-yellow-300">
            {(tweets.reduce((sum, t) => sum + t.confidence, 0) / tweets.length * 100).toFixed(0)}%
          </div>
          <div className="text-sm text-teal-200">औसत विश्वास (Avg Confidence)</div>
        </Card>
      </div>

      {/* Pending Tweets */}
      <div className="space-y-4">
        <h3 className="text-2xl font-semibold text-white">समीक्षा के लिए ट्वीट (Tweets for Review)</h3>
        {pendingTweets.map((tweet) => (
          <Card key={tweet.id} className="p-4">
            {/* Original Tweet */}
            <div className="mb-4 pb-4 border-b border-teal-700">
              <div className="flex justify-between items-start mb-2">
                <div className="text-xs text-teal-300">{new Date(tweet.timestamp).toLocaleString('hi-IN')}</div>
                <div className={`text-xs px-2 py-1 rounded ${
                  tweet.confidence > 0.7 ? 'bg-green-900 text-green-200' :
                  tweet.confidence > 0.5 ? 'bg-yellow-900 text-yellow-200' :
                  'bg-red-900 text-red-200'
                }`}>
                  विश्वास: {(tweet.confidence * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-teal-50 mb-2">{tweet.content}</div>
            </div>

            {/* Parsed Data */}
            {editingId === tweet.id ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-teal-200 mb-1">घटना प्रकार (Event Type)</label>
                  <input
                    type="text"
                    value={editForm.event_type}
                    onChange={(e) => setEditForm({...editForm, event_type: e.target.value})}
                    className="w-full px-3 py-2 bg-teal-900/50 text-white rounded border border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-teal-200 mb-1">स्थान (Locations - comma separated)</label>
                  <input
                    type="text"
                    value={editForm.locations}
                    onChange={(e) => setEditForm({...editForm, locations: e.target.value})}
                    className="w-full px-3 py-2 bg-teal-900/50 text-white rounded border border-teal-700"
                    placeholder="रायगढ़, छत्तीसगढ़"
                  />
                </div>
                <div>
                  <label className="block text-sm text-teal-200 mb-1">लोग (People - comma separated)</label>
                  <input
                    type="text"
                    value={editForm.people}
                    onChange={(e) => setEditForm({...editForm, people: e.target.value})}
                    className="w-full px-3 py-2 bg-teal-900/50 text-white rounded border border-teal-700"
                    placeholder="विक्रम उसेंडी, पवन पटेल"
                  />
                </div>
                <div>
                  <label className="block text-sm text-teal-200 mb-1">संगठन (Organizations - comma separated)</label>
                  <input
                    type="text"
                    value={editForm.organizations}
                    onChange={(e) => setEditForm({...editForm, organizations: e.target.value})}
                    className="w-full px-3 py-2 bg-teal-900/50 text-white rounded border border-teal-700"
                    placeholder="भारतीय जनता पार्टी"
                  />
                </div>
                <div>
                  <label className="block text-sm text-teal-200 mb-1">योजनाएं (Schemes - comma separated)</label>
                  <input
                    type="text"
                    value={editForm.schemes}
                    onChange={(e) => setEditForm({...editForm, schemes: e.target.value})}
                    className="w-full px-3 py-2 bg-teal-900/50 text-white rounded border border-teal-700"
                    placeholder="प्रधानमंत्री आवास योजना"
                  />
                </div>
                <div className="flex gap-2">
                  <SoftButton onClick={() => handleSave(tweet.id)}>✅ सहेजें (Save)</SoftButton>
                  <SoftButton onClick={() => setEditingId(null)}>❌ रद्द करें (Cancel)</SoftButton>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-teal-300">घटना:</span>
                    <span className="ml-2 text-white">{tweet.parsed.event_type || '—'}</span>
                  </div>
                  <div>
                    <span className="text-teal-300">स्थान:</span>
                    <span className="ml-2 text-white">
                      {tweet.parsed.locations?.map((l: any) => l.name || l).join(', ') || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-teal-300">लोग:</span>
                    <span className="ml-2 text-white">{tweet.parsed.people?.join(', ') || '—'}</span>
                  </div>
                  <div>
                    <span className="text-teal-300">संगठन:</span>
                    <span className="ml-2 text-white">{tweet.parsed.organizations?.join(', ') || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-teal-300">योजनाएं:</span>
                    <span className="ml-2 text-white">{tweet.parsed.schemes?.join(', ') || '—'}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <SoftButton onClick={() => handleApprove(tweet.id)}>✅ स्वीकार (Approve)</SoftButton>
                  <SoftButton onClick={() => handleEdit(tweet)}>✏️ संपादित (Edit)</SoftButton>
                  <SoftButton onClick={() => handleReject(tweet.id)}>❌ अस्वीकार (Reject)</SoftButton>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Reviewed Tweets */}
      {reviewedTweets.length > 0 && (
        <div className="space-y-4 mt-8">
          <h3 className="text-2xl font-semibold text-white">समीक्षित ट्वीट (Reviewed Tweets)</h3>
          {reviewedTweets.map((tweet) => (
            <Card key={tweet.id} className="p-4 opacity-60">
              <div className="flex justify-between items-start">
                <div className="text-teal-50">{tweet.content.substring(0, 100)}...</div>
                <div className={`text-xs px-2 py-1 rounded ${
                  tweet.review_status === 'approved' ? 'bg-green-900 text-green-200' :
                  tweet.review_status === 'rejected' ? 'bg-red-900 text-red-200' :
                  'bg-yellow-900 text-yellow-200'
                }`}>
                  {tweet.review_status}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

