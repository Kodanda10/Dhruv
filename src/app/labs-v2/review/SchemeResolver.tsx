'use client';

import { useState } from 'react';

interface SchemeResolverProps {
  parsedSchemes: string[];
  onResolve: (resolvedSchemes: string[]) => void;
}

export default function SchemeResolver({ parsedSchemes, onResolve }: SchemeResolverProps) {
  const [schemes, setSchemes] = useState<string[]>(parsedSchemes);
  const [newScheme, setNewScheme] = useState('');

  const handleAddScheme = () => {
    if (newScheme.trim() && !schemes.includes(newScheme.trim())) {
      setSchemes([...schemes, newScheme.trim()]);
      setNewScheme('');
    }
  };

  const handleRemoveScheme = (schemeToRemove: string) => {
    setSchemes(schemes.filter(s => s !== schemeToRemove));
  };

  return (
    <div className="p-4 bg-gray-100 rounded-md text-sm">
      <h4 className="font-semibold mb-2">Parsed Schemes</h4>
      
      <ul className="space-y-1 mb-3">
        {schemes.map((scheme, index) => (
          <li key={index} className="flex items-center justify-between bg-white p-2 rounded-md">
            <span>{scheme}</span>
            <button
              onClick={() => handleRemoveScheme(scheme)}
              className="text-red-500 hover:text-red-700"
              aria-label={`Remove ${scheme}`}
            >
              &times;
            </button>
          </li>
        ))}
        {schemes.length === 0 && <p className="text-gray-500">No schemes identified.</p>}
      </ul>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="flex-grow p-2 border border-gray-300 rounded-md"
          placeholder="Add a scheme"
          value={newScheme}
          onChange={(e) => setNewScheme(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          onClick={handleAddScheme}
        >
          Add
        </button>
      </div>

      <div className="mt-4 text-right">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          onClick={() => onResolve(schemes)}
        >
          Confirm Schemes
        </button>
      </div>
    </div>
  );
}
