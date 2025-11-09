'use client';

import { useState } from 'react';

interface PeopleResolverProps {
  parsedPeople: string[];
  onResolve: (resolvedPeople: string[]) => void;
}

export default function PeopleResolver({ parsedPeople, onResolve }: PeopleResolverProps) {
  const [people, setPeople] = useState<string[]>(parsedPeople);
  const [newPerson, setNewPerson] = useState('');

  const handleAddPerson = () => {
    if (newPerson.trim() && !people.includes(newPerson.trim())) {
      setPeople([...people, newPerson.trim()]);
      setNewPerson('');
    }
  };

  const handleRemovePerson = (personToRemove: string) => {
    setPeople(people.filter(p => p !== personToRemove));
  };

  return (
    <div className="p-4 bg-gray-100 rounded-md text-sm">
      <h4 className="font-semibold mb-2">Parsed People</h4>
      
      <ul className="space-y-1 mb-3">
        {people.map((person, index) => (
          <li key={index} className="flex items-center justify-between bg-white p-2 rounded-md">
            <span>{person}</span>
            <button
              onClick={() => handleRemovePerson(person)}
              className="text-red-500 hover:text-red-700"
              aria-label={`Remove ${person}`}
            >
              &times;
            </button>
          </li>
        ))}
        {people.length === 0 && <p className="text-gray-500">No people identified.</p>}
      </ul>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="flex-grow p-2 border border-gray-300 rounded-md"
          placeholder="Add a person"
          value={newPerson}
          onChange={(e) => setNewPerson(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          onClick={handleAddPerson}
        >
          Add
        </button>
      </div>

      <div className="mt-4 text-right">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          onClick={() => onResolve(people)}
        >
          Confirm People
        </button>
      </div>
    </div>
  );
}
