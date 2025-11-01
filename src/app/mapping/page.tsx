'use client';

import { useState, useEffect } from 'react';

interface Village {
  village: string;
  hindi: string;
  nukta_hindi: string;
  english: string;
  transliteration: string;
  district: string;
  assembly_constituency: string;
  parliamentary_constituency: string;
  applications?: number;
  status?: string;
}

export default function MappingPage() {
  const [villages, setVillages] = useState<Village[]>([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<Village[]>([]);

  useEffect(() => {
    // Load processed data from API
    fetch('/api/villages')
      .then((res) => res.json())
      .then((data) => {
        setVillages(data);
        setFiltered(data);
      })
      .catch((err) => console.error('Error loading data:', err));
  }, []);

  useEffect(() => {
    const filtered = villages.filter(
      (v) =>
        v.hindi.toLowerCase().includes(search.toLowerCase()) ||
        v.english.toLowerCase().includes(search.toLowerCase()) ||
        v.transliteration.toLowerCase().includes(search.toLowerCase()) ||
        v.district.toLowerCase().includes(search.toLowerCase()),
    );
    setFiltered(filtered);
  }, [search, villages]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Chhattisgarh Village Mapping</h1>
      <input
        type="text"
        placeholder="Search by village name, district, or constituency..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      />
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Hindi</th>
            <th className="border p-2">English</th>
            <th className="border p-2">Transliteration</th>
            <th className="border p-2">District</th>
            <th className="border p-2">Assembly Constituency</th>
            <th className="border p-2">Parliamentary Constituency</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((v, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="border p-2">{v.hindi}</td>
              <td className="border p-2">{v.english}</td>
              <td className="border p-2">{v.transliteration}</td>
              <td className="border p-2">{v.district}</td>
              <td className="border p-2">{v.assembly_constituency}</td>
              <td className="border p-2">{v.parliamentary_constituency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
