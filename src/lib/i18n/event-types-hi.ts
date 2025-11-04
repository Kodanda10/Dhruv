/**
 * Hindi Translation Map for Event Types
 * Maps English event type keys to Hindi labels for display
 * TDD: Comprehensive test coverage for all translations
 */

export const EVENT_TYPE_HINDI: Record<string, string> = {
  // Core event types
  'meeting': 'बैठक',
  'review_meeting': 'समीक्षा बैठक',
  'inauguration': 'लोकार्पण',
  'condolence': 'शोक संवेदना',
  'meet_greet': 'भेंट',
  'tour': 'दौरा',
  'public_event': 'कार्यक्रम',
  'ceremony': 'समारोह',
  'scheme_announcement': 'योजना घोषणा',
  'inspection': 'निरीक्षण',
  'rally': 'रैली',
  'press_conference': 'प्रेस वार्ता',
  'award_ceremony': 'पुरस्कार समारोह',
  'foundation_stone': 'शिलान्यास',
  'groundbreaking': 'भूमि पूजन',
  'completion_ceremony': 'पूर्णता समारोह',
  'anniversary': 'वर्षगांठ',
  'festival_celebration': 'त्यौहार समारोह',
  'cultural_event': 'सांस्कृतिक कार्यक्रम',
  'sports_event': 'खेल कार्यक्रम',
  'educational_event': 'शैक्षिक कार्यक्रम',
  'health_camp': 'स्वास्थ्य शिविर',
  'blood_donation': 'रक्तदान शिविर',
  'tree_plantation': 'वृक्षारोपण',
  'cleanliness_drive': 'स्वच्छता अभियान',
  'awareness_program': 'जागरूकता कार्यक्रम',
  'workshop': 'कार्यशाला',
  'training_program': 'प्रशिक्षण कार्यक्रम',
  'seminar': 'सेमिनार',
  'conference': 'सम्मेलन',
  'exhibition': 'प्रदर्शनी',
  'fair': 'मेला',
  'market_visit': 'बाजार दौरा',
  'factory_visit': 'कारखाना दौरा',
  'hospital_visit': 'अस्पताल दौरा',
  'school_visit': 'स्कूल दौरा',
  'college_visit': 'कॉलेज दौरा',
  'village_visit': 'गांव दौरा',
  'relief_distribution': 'सहायता वितरण',
  'compensation_distribution': 'मुआवजा वितरण',
  'grant_distribution': 'अनुदान वितरण',
  'certificate_distribution': 'प्रमाण पत्र वितरण',
  'kit_distribution': 'किट वितरण',
  'ration_distribution': 'राशन वितरण',
  'blanket_distribution': 'कंबल वितरण',
  'medicine_distribution': 'दवा वितरण',
  'book_distribution': 'किताब वितरण',
  'seed_distribution': 'बीज वितरण',
  'equipment_distribution': 'उपकरण वितरण',
  'bicycle_distribution': 'साइकिल वितरण',
  'laptop_distribution': 'लैपटॉप वितरण',
  'mobile_distribution': 'मोबाइल वितरण',
  'solar_light_distribution': 'सोलर लाइट वितरण',
  'pump_distribution': 'पंप वितरण',
  'toilet_distribution': 'शौचालय वितरण',
  'house_distribution': 'मकान वितरण',
  'land_distribution': 'जमीन वितरण',
  'loan_distribution': 'ऋण वितरण',
  'subsidy_distribution': 'सब्सिडी वितरण',
  'pension_distribution': 'पेंशन वितरण',
  'scholarship_distribution': 'छात्रवृत्ति वितरण',
  'stipend_distribution': 'मानदेय वितरण',
  'other': 'अन्य'
};

/**
 * Get Hindi translation for event type
 * @param eventType - English event type key
 * @returns Hindi translation or 'अन्य' if not found
 */
export function getEventTypeInHindi(eventType: string | null | undefined): string {
  if (!eventType) return 'अन्य';
  return EVENT_TYPE_HINDI[eventType] || 'अन्य';
}

/**
 * Get all available event types in Hindi
 * @returns Array of Hindi event type labels
 */
export function getAllEventTypesInHindi(): string[] {
  return Object.values(EVENT_TYPE_HINDI);
}

/**
 * Check if an event type has a Hindi translation
 * @param eventType - English event type key
 * @returns true if translation exists
 */
export function hasHindiTranslation(eventType: string): boolean {
  return eventType in EVENT_TYPE_HINDI;
}
