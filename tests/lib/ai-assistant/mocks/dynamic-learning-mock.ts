/**
 * Mock Dynamic Learning System for Tests
 * 
 * Provides realistic mock data without requiring database connection
 */

import { DynamicLearningSystem } from '@/lib/dynamic-learning';

export class MockDynamicLearningSystem {
  private mockSuggestions = {
    locations: [
      'रायपुर',
      'बिलासपुर',
      'दुर्ग',
      'रायगढ़',
      'अंतागढ़',
      'कोरबा',
      'जांजगीर-चांपा',
      'महासमुंद',
      'धमतरी',
      'कांकेर'
    ],
    eventTypes: [
      'बैठक',
      'कार्यक्रम',
      'रैली',
      'शिलान्यास',
      'उद्घाटन',
      'समारोह',
      'संबोधन',
      'औपचारिक कार्यक्रम',
      'जनसुनवाई',
      'जनसंपर्क'
    ],
    schemes: [
      'PM-Kisan',
      'आयुष्मान योजना',
      'उज्ज्वला योजना',
      'मुख्यमंत्री बलराम योजना',
      'पेंशन योजना',
      'किसान सम्मान निधि योजना',
      'अटल आवास योजना',
      'स्वच्छ भारत मिशन',
      'डिजिटल इंडिया',
      'जन धन योजना'
    ],
    hashtags: [
      '#छत्तीसगढ़',
      '#मुख्यमंत्री',
      '#उत्तरवर्ती',
      '#ChhattisgarhDevelopment',
      '#TransparentGovernance',
      '#JanDhanYojana',
      '#PradhanMantriSchemes',
      '#सुशासन',
      '#विकास',
      '#बदलाव'
    ]
  };

  async getIntelligentSuggestions(context: { tweetText: string; currentParsed: any }): Promise<any> {
    // Return mock suggestions based on tweet text
    const tweetText = context?.tweetText?.toLowerCase() || '';
    
    return {
      eventTypes: this.getRelevantEventTypes(tweetText),
      schemes: this.getRelevantSchemes(tweetText),
      locations: this.getRelevantLocations(tweetText),
      hashtags: this.getRelevantHashtags(tweetText, context.currentParsed)
    };
  }

  private getRelevantEventTypes(tweetText: string): any[] {
    // Simple keyword matching for event types
    const keywords = {
      'बैठक': ['meeting', 'meet', 'discussion', 'talk', 'बैठक'],
      'कार्यक्रम': ['program', 'event', 'function', 'कार्यक्रम'],
      'रैली': ['rally', 'gathering', 'प्रदर्शन', 'रैली'],
      'शिलान्यास': ['foundation', 'stone', 'start', 'शिलान्यास'],
      'उद्घाटन': ['inauguration', 'opening', 'उद्घाटन'],
      'संबोधन': ['address', 'speech', 'संबोधन']
    };

    for (const [eventType, keywordsList] of Object.entries(keywords)) {
      if (keywordsList.some(kw => tweetText.includes(kw.toLowerCase()))) {
        return [{
          name_hi: eventType,
          name_en: eventType,
          usage_count: 10
        }];
      }
    }

    // Default: return generic event types
    return [
      { name_hi: 'कार्यक्रम', name_en: 'Program', usage_count: 5 },
      { name_hi: 'बैठक', name_en: 'Meeting', usage_count: 3 }
    ];
  }

  private getRelevantSchemes(tweetText: string): any[] {
    // Simple keyword matching for schemes
    const schemeKeywords = {
      'PM-Kisan': ['kisan', 'किसान', 'farm'],
      'आयुष्मान': ['ayushman', 'health', 'स्वास्थ्य'],
      'उज्ज्वला': ['ujjwala', 'gas', 'गैस'],
      'बलराम': ['balram', 'pension', 'पेंशन']
    };

    for (const [scheme, keywords] of Object.entries(schemeKeywords)) {
      if (keywords.some(kw => tweetText.includes(kw.toLowerCase()))) {
        return [{
          name_hi: scheme,
          name_en: scheme,
          usage_count: 8
        }];
      }
    }

    // Default: return popular schemes
    return [
      { name_hi: 'PM-Kisan', name_en: 'PM Kisan', usage_count: 15 },
      { name_hi: 'आयुष्मान', name_en: 'Ayushman', usage_count: 10 }
    ];
  }

  private getRelevantLocations(tweetText: string): any[] {
    // Extract location names from tweet text
    const locations = this.mockSuggestions.locations.filter(loc => 
      tweetText.includes(loc.toLowerCase())
    );

    if (locations.length > 0) {
      return locations.map(loc => ({
        value_hi: loc,
        value_en: loc,
        usage_count: 20
      }));
    }

    // Default: return popular locations
    return [
      { value_hi: 'रायपुर', value_en: 'Raipur', usage_count: 30 },
      { value_hi: 'बिलासपुर', value_en: 'Bilaspur', usage_count: 25 },
      { value_hi: 'दुर्ग', value_en: 'Durg', usage_count: 20 }
    ];
  }

  private getRelevantHashtags(tweetText: string, currentParsed: any): string[] {
    // Generate contextual hashtags
    const hashtags = [];
    
    // Add location-based hashtag
    if (currentParsed?.locations?.length > 0) {
      const location = currentParsed.locations[0];
      hashtags.push(`#${location}`);
    }

    // Add scheme-based hashtag
    if (currentParsed?.schemes_mentioned?.length > 0) {
      const scheme = currentParsed.schemes_mentioned[0];
      hashtags.push(`#${scheme.replace(/\s+/g, '')}`);
    }

    // Add generic hashtags
    hashtags.push('#छत्तीसगढ़');
    hashtags.push('#सुशासन');

    return hashtags;
  }

  async learnFromHumanFeedback(feedback: any): Promise<any> {
    // Mock learning from human feedback
    return {
      success: true,
      learnedEntities: ['locations', 'schemes'],
      confidence: 0.9
    };
  }
}

