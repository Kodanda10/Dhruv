'use client';

import { useState, useEffect } from 'react';
import LocationResolver from './LocationResolver';
import EventResolver from './EventResolver';
import PeopleResolver from './PeopleResolver';
import SchemeResolver from './SchemeResolver';
import PinnedSummary from './PinnedSummary';
import LearningBanner from './LearningBanner';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface ParsedEvent {
  id: string;
  tweetText: string;
  parsed: {
    location: string;
    eventType: string;
    people: string[];
    schemes: string[];
  };
}

type PageState = {
  event: ParsedEvent | null;
  loading: boolean;
  error: string | null;
};

export default function ReviewClientPage() {
  const [state, setState] = useState<PageState>({
    event: null,
    loading: true,
    error: null,
  });

  // State to hold resolved values
  const [resolvedLocation, setResolvedLocation] = useState<string | null>(null);
  const [resolvedEvent, setResolvedEvent] = useState<string | null>(null);
  const [resolvedPeople, setResolvedPeople] = useState<string[]>([]);
  const [resolvedSchemes, setResolvedSchemes] = useState<string[]>([]);

  useEffect(() => {
    async function fetchNextEvent() {
      try {
        setState(prevState => ({ ...prevState, loading: true, error: null }));
        const response = await fetch('/api/labs-v2/parsed-events/next');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch next event.');
        }
        const data: ParsedEvent = await response.json();
        setState(prevState => ({ ...prevState, event: data }));
        // Initialize resolved states with parsed values
        setResolvedLocation(data.parsed.location);
        setResolvedEvent(data.parsed.eventType);
        setResolvedPeople(data.parsed.people);
        setResolvedSchemes(data.parsed.schemes);
      } catch (err: any) {
        setState(prevState => ({ ...prevState, error: err.message || 'An unknown error occurred.' }));
      } finally {
        setState(prevState => ({ ...prevState, loading: false }));
      }
    }

    fetchNextEvent();
  }, []); // Empty dependency array means this runs once on mount

  // Callback functions for resolvers
  const handleLocationResolve = (location: string | null) => {
    setResolvedLocation(location);
    console.log('Location resolved:', location);
  };

  const handleEventResolve = (event: string | null) => {
    setResolvedEvent(event);
    console.log('Event resolved:', event);
  };

  const handlePeopleResolve = (people: string[]) => {
    setResolvedPeople(people);
    console.log('People resolved:', people);
  };

  const handleSchemeResolve = (schemes: string[]) => {
    setResolvedSchemes(schemes);
    console.log('Schemes resolved:', schemes);
  };

  // Define keyboard shortcuts
  useKeyboardShortcuts([
    { key: '1', ctrlKey: true, callback: () => console.log('Triggered Confirm Location') },
    { key: '2', ctrlKey: true, callback: () => console.log('Triggered Confirm Event') },
    { key: '3', ctrlKey: true, callback: () => console.log('Triggered Confirm People') },
    { key: '4', ctrlKey: true, callback: () => console.log('Triggered Confirm Schemes') },
  ]);

  if (state.loading) {
    return <div className="text-center p-8">Loading review data...</div>;
  }

  if (state.error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error:</strong>
        <span className="block sm:inline"> {state.error}</span>
      </div>
    );
  }

  if (!state.event) {
    return <div className="text-center p-8">No events are currently pending review.</div>;
  }

  return (
    <>
      <LearningBanner />
      <h1 className="text-3xl font-bold mb-6">Labs V2 Review</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        {/* Main Content Column */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">Tweet Content</h2>
          <div className="prose max-w-none p-4 bg-gray-50 rounded-md">
            <p>{state.event.tweetText}</p>
          </div>
          
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-2">Parsed Entities</h3>
            <div className="space-y-2">
              <p><strong>Location:</strong> {state.event.parsed.location}</p>
              <p><strong>Event Type:</strong> {state.event.parsed.eventType}</p>
              <p><strong>People:</strong> {state.event.parsed.people.join(', ')}</p>
              <p><strong>Schemes:</strong> {state.event.parsed.schemes.join(', ')}</p>
            </div>
          </div>
        </div>

        {/* Right-hand Workspace Column */}
        <div className="bg-white p-6 rounded-lg shadow space-y-8">
          <PinnedSummary
            location={resolvedLocation || 'N/A'}
            eventType={resolvedEvent || 'N/A'}
            peopleCount={resolvedPeople.length}
            schemesCount={resolvedSchemes.length}
          />
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Location Resolver</h3>
            <LocationResolver
              parsedLocation={state.event.parsed.location}
              onResolve={handleLocationResolve}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Event Resolver</h3>
            <EventResolver
              parsedEventType={state.event.parsed.eventType}
              tweetText={state.event.tweetText}
              onResolve={handleEventResolve}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">People Resolver</h3>
            <PeopleResolver
              parsedPeople={state.event.parsed.people}
              onResolve={handlePeopleResolve}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Scheme Resolver</h3>
            <SchemeResolver
              parsedSchemes={state.event.parsed.schemes}
              onResolve={handleSchemeResolve}
            />
          </div>
        </div>
      </div>
    </>
  );
}
