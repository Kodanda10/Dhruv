'use client';

import { useState, useEffect } from 'react';

export function useFieldHistory(fieldName: string) {
  const [history, setHistory] = useState<string[]>([]);
  
  useEffect(() => {
    const key = `review_history_${fieldName}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          setHistory(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse field history:', e);
          setHistory([]);
        }
      }
    } catch (e) {
      console.error('Failed to access localStorage:', e);
      setHistory([]);
    }
  }, [fieldName]);
  
  const addToHistory = (value: string) => {
    if (!value.trim()) return;
    
    const updated = [value.trim(), ...history.filter(h => h !== value.trim())].slice(0, 10);
    setHistory(updated);
    
    const key = `review_history_${fieldName}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };
  
  const getFilteredHistory = (query: string): string[] => {
    if (!query.trim()) return history;
    
    const lowercaseQuery = query.toLowerCase();
    return history.filter(item => 
      item.toLowerCase().includes(lowercaseQuery)
    );
  };
  
  return { 
    history, 
    addToHistory, 
    getFilteredHistory 
  };
}
