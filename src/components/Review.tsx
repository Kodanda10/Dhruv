"use client";
import { useState, useEffect } from 'react';

interface Post {
  id: number;
  timestamp: string;
  content: string;
}

interface Parsed {
  when?: string;
  where?: string[];
  what?: string[];
  sentiment?: string;
  themes?: string[];
  entities?: Array<{ text: string; type: string; start: number; end: number }>;
}

export default function Review() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [corrections, setCorrections] = useState<Partial<Parsed>>({});
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterId, setFilterId] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Fetch posts
  useEffect(() => {
    setLoading(true);
    fetch('/api/review/list')
      .then((res) => res.json())
      .then((data) => {
        setPosts(data);
        setFilteredPosts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching posts:', err);
        setLoading(false);
      });
  }, []);

  // Filter posts
  useEffect(() => {
    let filtered = posts;
    if (filterId) {
      filtered = filtered.filter((p) => p.id.toString().includes(filterId));
    }
    if (filterStatus !== 'all') {
      // For now, all are unreviewed
    }
    setFilteredPosts(filtered);
  }, [posts, filterId, filterStatus]);

  // Parse current post
  useEffect(() => {
    if (filteredPosts.length > 0 && currentIndex < filteredPosts.length) {
      setLoading(true);
      fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: filteredPosts[currentIndex].content }),
      })
        .then((res) => res.json())
        .then((data) => {
          setParsed(data.extraction || {});
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error parsing post:', err);
          setLoading(false);
        });
    }
  }, [currentIndex, filteredPosts]);

  const handleApprove = () => {
    const data = {
      id: filteredPosts[currentIndex].id,
      original: filteredPosts[currentIndex],
      corrected: { ...parsed, ...corrections },
      approved: true,
    };
    fetch('/api/review/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(() => {
        alert('Approved and stored!');
        setCurrentIndex(currentIndex + 1);
        setCorrections({});
        setParsed(null);
      })
      .catch((err) => console.error('Error storing review:', err));
  };

  const handleReject = () => {
    setCurrentIndex(currentIndex + 1);
    setCorrections({});
    setParsed(null);
  };

  const handleExport = () => {
    fetch('/api/review/export')
      .then((res) => res.json())
      .then((data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reviewed_posts.json';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => console.error('Error exporting:', err));
  };

  if (loading) return <p>Loading...</p>;
  if (filteredPosts.length === 0) return <p>No posts to review.</p>;
  if (currentIndex >= filteredPosts.length) return <p>All posts reviewed!</p>;

  const post = filteredPosts[currentIndex];
  const combined = { ...parsed, ...corrections };

  return (
    <div className="p-4 border rounded shadow">
      <h2 className="text-xl mb-4">Review Post {post.id}</h2>

      {/* Filters */}
      <div className="mb-4">
        <label>Filter by ID: <input className="border p-1 ml-2" value={filterId} onChange={(e) => setFilterId(e.target.value)} /></label>
        <label className="ml-4">Status:
          <select className="border p-1 ml-2" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="reviewed">Reviewed</option>
            <option value="unreviewed">Unreviewed</option>
          </select>
        </label>
      </div>

      {/* Post Content */}
      <div className="mb-4">
        <h3 className="font-bold">Original Text:</h3>
        <p>{post.content}</p>
      </div>

      {/* Parsed Data */}
      <div className="mb-4">
        <h3 className="font-bold">Parsed Data:</h3>
        <label>When: <input className="border p-1 ml-2" value={combined.when || ''} onChange={(e) => setCorrections({ ...corrections, when: e.target.value })} /></label><br />
        <label>Where: <input className="border p-1 ml-2" value={combined.where?.join(', ') || ''} onChange={(e) => setCorrections({ ...corrections, where: e.target.value.split(', ') })} /></label><br />
        <label>What: <input className="border p-1 ml-2" value={combined.what?.join(', ') || ''} onChange={(e) => setCorrections({ ...corrections, what: e.target.value.split(', ') })} /></label><br />
        <label>Themes: <input className="border p-1 ml-2" value={combined.themes?.join(', ') || ''} onChange={(e) => setCorrections({ ...corrections, themes: e.target.value.split(', ') })} /></label><br />
        <label>Sentiment: <input className="border p-1 ml-2" value={combined.sentiment || ''} onChange={(e) => setCorrections({ ...corrections, sentiment: e.target.value })} /></label>
      </div>

      {/* Actions */}
      <div className="mb-4">
        <button className="bg-green-500 text-white p-2 mr-2" onClick={handleApprove}>Approve</button>
        <button className="bg-red-500 text-white p-2 mr-2" onClick={handleReject}>Reject</button>
        <button className="bg-blue-500 text-white p-2 mr-2" onClick={handleExport}>Export Reviewed Data</button>
        <p>{currentIndex + 1} / {filteredPosts.length} reviewed</p>
      </div>
    </div>
  );
}
