import type { Metadata } from 'next';
import SearchClientPage from './SearchClientPage';

export const metadata: Metadata = {
  title: 'FAISS Search',
  description: 'A page to test FAISS vector search.',
};

export default function LabsSearchPage() {
  return <SearchClientPage />;
}
