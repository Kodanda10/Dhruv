/**
 * Review Edit Form Component
 *
 * Hindi-Only Dashboard: All labels, buttons, and validation messages in Hindi
 * Human-in-the-Loop: Allow editing of all parsed fields with validation
 * Approval Workflow: Approve/Skip/Reject with custom notes and confirmation
 * Accessibility: WCAG 2.1 AA compliant with proper form structure
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getEventTypeInHindi, EVENT_TYPE_HINDI } from '@/lib/i18n/event-types-hi';

interface ParsedTweet {
  id: string;
  content: string;
  event_type: string;
  event_type_hi?: string;
  locations: string[];
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  needs_review: boolean;
  review_status: string;
}

interface ReviewEditFormProps {
  tweet: ParsedTweet;
  onSave: (updatedTweet: ParsedTweet & { review_notes?: string }) => Promise<void>;
  onApprove: (tweetId: string, notes: string) => Promise<void>;
  onReject: (tweetId: string, notes: string) => Promise<void>;
  onSkip: (tweetId: string) => Promise<void>;
}

export default function ReviewEditForm({
  tweet,
  onSave,
  onApprove,
  onReject,
  onSkip
}: ReviewEditFormProps) {
  const { isAuthenticated } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    event_type: tweet.event_type,
    locations: [...tweet.locations],
    people_mentioned: [...tweet.people_mentioned],
    organizations: [...tweet.organizations],
    schemes_mentioned: [...tweet.schemes_mentioned],
    review_notes: ''
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    type: 'approve' | 'reject' | null;
    notes: string;
  } | null>(null);

  // Only show for authenticated admin users
  if (!isAuthenticated) {
    return null;
  }

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.event_type.trim()) {
      newErrors.event_type = 'कृपया घटना प्रकार चुनें';
    }

    // Validate array fields for malicious content
    const validateArrayField = (field: string[], fieldName: string) => {
      const maliciousPattern = /[<>'"&\\]/;
      if (field.some(item => maliciousPattern.test(item))) {
        newErrors[fieldName] = `अमान्य ${fieldName} प्रारूप`;
      }
    };

    validateArrayField(formData.locations, 'स्थान');
    validateArrayField(formData.people_mentioned, 'व्यक्ति');
    validateArrayField(formData.organizations, 'संगठन');
    validateArrayField(formData.schemes_mentioned, 'योजनाएं');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleInputChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const handleEventTypeChange = useCallback((value: string) => {
    handleInputChange('event_type', value);
  }, [handleInputChange]);

  const handleArrayFieldAdd = useCallback((field: keyof typeof formData, value: string) => {
    if (!value.trim()) return;

    const currentArray = formData[field] as string[];
    if (!currentArray.includes(value.trim())) {
      handleInputChange(field, [...currentArray, value.trim()]);
    }
  }, [formData, handleInputChange]);

  const handleArrayFieldRemove = useCallback((field: keyof typeof formData, value: string) => {
    const currentArray = formData[field] as string[];
    handleInputChange(field, currentArray.filter(item => item !== value));
  }, [formData, handleInputChange]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const updatedTweet = {
        ...tweet,
        ...formData,
        event_type_hi: getEventTypeInHindi(formData.event_type)
      };

      await onSave(updatedTweet);
      console.log('समीक्षा सहेजी गई:', updatedTweet);
    } catch (error) {
      console.error('सहेजने में त्रुटि:', error);
      setErrors({ general: 'सहेजने में त्रुटि हुई' });
    } finally {
      setIsLoading(false);
    }
  }, [formData, tweet, validateForm, onSave]);

  const handleActionClick = useCallback((action: 'approve' | 'reject') => {
    setShowConfirmDialog({ type: action, notes: '' });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!showConfirmDialog) return;

    setIsLoading(true);
    try {
      if (showConfirmDialog.type === 'approve') {
        await onApprove(tweet.id, showConfirmDialog.notes);
        console.log('ट्वीट मंजूरी दे दी गई:', tweet.id);
      } else if (showConfirmDialog.type === 'reject') {
        await onReject(tweet.id, showConfirmDialog.notes);
        console.log('ट्वीट अस्वीकार कर दिया गया:', tweet.id);
      }
      setShowConfirmDialog(null);
    } catch (error) {
      console.error('कार्रवाई में त्रुटि:', error);
      setErrors({ general: `${showConfirmDialog.type === 'approve' ? 'मंजूरी' : 'अस्वीकार'} करने में त्रुटि हुई` });
    } finally {
      setIsLoading(false);
    }
  }, [showConfirmDialog, tweet.id, onApprove, onReject]);

  const handleSkip = useCallback(async () => {
    setIsLoading(true);
    try {
      await onSkip(tweet.id);
      console.log('ट्वीट छोड़ दिया गया:', tweet.id);
    } catch (error) {
      console.error('छोड़ने में त्रुटि:', error);
      setErrors({ general: 'छोड़ने में त्रुटि हुई' });
    } finally {
      setIsLoading(false);
    }
  }, [tweet.id, onSkip]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="space-y-6"
        role="form"
        aria-label="ट्वीट समीक्षा फ़ॉर्म"
      >
        {/* Event Type */}
        <div>
          <label htmlFor="event_type" className="block text-sm font-medium text-gray-700 mb-2">
            घटना प्रकार *
          </label>
          <select
            id="event_type"
            value={formData.event_type}
            onChange={(e) => handleEventTypeChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.event_type ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
            aria-describedby={errors.event_type ? "event_type_error" : undefined}
          >
            <option value="">चुनें...</option>
            {Object.entries(EVENT_TYPE_HINDI).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {errors.event_type && (
            <p id="event_type_error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.event_type}
            </p>
          )}
        </div>

        {/* Locations */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">स्थान</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="नए स्थान जोड़ें..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleArrayFieldAdd('locations', (e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.locations.map((location, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
              >
                {location}
                <button
                  type="button"
                  onClick={() => handleArrayFieldRemove('locations', location)}
                  className="text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                  aria-label={`${location} हटाएं`}
                  disabled={isLoading}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {errors.locations && (
            <p className="mt-1 text-sm text-red-600" role="alert">{errors.locations}</p>
          )}
        </div>

        {/* People Mentioned */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">उल्लिखित व्यक्ति</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="नया व्यक्ति जोड़ें..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleArrayFieldAdd('people_mentioned', (e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.people_mentioned.map((person, index) => (
              <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                {person}
                <button
                  type="button"
                  onClick={() => handleArrayFieldRemove('people_mentioned', person)}
                  className="text-green-600 hover:text-green-800"
                  aria-label={`${person} हटाएं`}
                  disabled={isLoading}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Organizations */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">संगठन</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="नया संगठन जोड़ें..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleArrayFieldAdd('organizations', (e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.organizations.map((org, index) => (
              <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                {org}
                <button
                  type="button"
                  onClick={() => handleArrayFieldRemove('organizations', org)}
                  className="text-purple-600 hover:text-purple-800"
                  aria-label={`${org} हटाएं`}
                  disabled={isLoading}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Schemes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">योजनाएं</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="नई योजना जोड़ें..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleArrayFieldAdd('schemes_mentioned', (e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.schemes_mentioned.map((scheme, index) => (
              <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
                {scheme}
                <button
                  type="button"
                  onClick={() => handleArrayFieldRemove('schemes_mentioned', scheme)}
                  className="text-orange-600 hover:text-orange-800"
                  aria-label={`${scheme} हटाएं`}
                  disabled={isLoading}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="review_notes" className="block text-sm font-medium text-gray-700 mb-2">
            टिप्पणी
          </label>
          <textarea
            id="review_notes"
            value={formData.review_notes}
            onChange={(e) => handleInputChange('review_notes', e.target.value)}
            placeholder="अपनी टिप्पणी यहाँ लिखें..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* General Error */}
        {errors.general && (
          <div className="text-red-600 text-sm" role="alert">
            {errors.general}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 text-gray-700 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            {isLoading ? 'प्रक्रिया में...' : 'छोड़ें'}
          </button>

          <button
            type="button"
            onClick={() => handleActionClick('reject')}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            अस्वीकार करें
          </button>

          <button
            type="button"
            onClick={() => handleActionClick('approve')}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            मंजूरी दें
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            {isLoading ? 'सहेजा जा रहा है...' : 'सहेजें'}
          </button>
        </div>
      </form>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {showConfirmDialog.type === 'approve' ? 'ट्वीट मंजूरी दें' : 'ट्वीट अस्वीकार करें'}
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              क्या आप इस ट्वीट को {showConfirmDialog.type === 'approve' ? 'मंजूरी देना' : 'अस्वीकार करना'} चाहते हैं?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {showConfirmDialog.type === 'approve' ? 'वैकल्पिक टिप्पणी' : 'अस्वीकार करने का कारण'} (वैकल्पिक)
              </label>
              <textarea
                value={showConfirmDialog.notes}
                onChange={(e) => setShowConfirmDialog(prev => prev ? { ...prev, notes: e.target.value } : null)}
                placeholder={showConfirmDialog.type === 'approve' ? 'वैकल्पिक टिप्पणी...' : 'अस्वीकार करने का कारण...'}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                disabled={isLoading}
              >
                रद्द करें
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors duration-200 ${
                  showConfirmDialog.type === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={isLoading}
              >
                {isLoading ? 'प्रक्रिया में...' : `हाँ, ${showConfirmDialog.type === 'approve' ? 'मंजूरी दें' : 'अस्वीकार करें'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
