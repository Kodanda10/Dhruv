import { Noto_Sans_Devanagari } from 'next/font/google';
import localFont from 'next/font/local';

// Use Noto Sans Devanagari as fallback for Hindi
export const notoDevanagari = Noto_Sans_Devanagari({ 
  weight: ['400','600','700'], 
  subsets: ['latin', 'devanagari'], 
  display: 'swap' 
});

// Professional font for title - Using Noto Sans Devanagari Bold as Kokila alternative
export const titleFont = Noto_Sans_Devanagari({ 
  weight: ['700'], 
  subsets: ['devanagari'], 
  display: 'swap' 
});


