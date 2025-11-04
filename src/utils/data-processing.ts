
import { logger } from '@/lib/utils/logger';
import { formatHindiDate } from '@/utils/parse';
import { getEventTypeHindi } from '@/lib/eventTypes';

export const parseServerRows = (serverRows: any[]) => {
    const source = serverRows.length > 0 ? serverRows : [];
    logger.debug('DashboardDark: Using data source:', serverRows.length > 0 ? 'serverRows (real data from database)' : 'empty (no fallback)', 'length:', source.length);
    
    return source.map((p: any, index: number) => {
      // Handle both old parsed structure and new database structure
      const isDbData = p.locations !== undefined; // Database data has locations directly
      
      if (isDbData) {
        // Database structure - ensure locations are always strings
        const locations: string[] = (p.locations || [])
          .map((l: any) => {
            if (typeof l === 'string') return l.trim();
            if (l && typeof l === 'object' && l !== null) {
              const name = l.name || l.location || '';
              return typeof name === 'string' ? name.trim() : '';
            }
            return '';
          })
          .filter((loc: string): loc is string => typeof loc === 'string' && loc.length > 0);
        const people = p.people_mentioned || [];
        const orgs = p.organizations || [];
        const schemes = p.schemes_mentioned || [];
        
        // Handle timestamp field - try multiple possible field names
        const timestamp = p.event_date || p.parsed_at || p.timestamp || p.created_at || new Date().toISOString();
        
        return {
          id: p.id || p.tweet_id || `tweet-${index}`,
          ts: timestamp,
          when: formatHindiDate(timestamp),
          where: locations,
          what: [p.event_type || 'अन्य'].filter(Boolean),
          which: {
            mentions: Array.isArray(people) ? people : [],
            hashtags: [...(Array.isArray(orgs) ? orgs : []), ...(Array.isArray(schemes) ? schemes : [])],
          },
          schemes: Array.isArray(schemes) ? schemes : [],
          how: p.content || p.text || `Tweet ID: ${p.tweet_id || p.id}`,
          confidence: p.confidence || 0,
          needs_review: p.needs_review || false,
          review_status: p.review_status || 'pending',
        };
      } else if (p.parsed && p.parsed.event_type) {
        // Old parsed structure
        const locations: string[] = (p.parsed.locations || [])
          .map((l: any) => {
            if (typeof l === 'string') return l.trim();
            if (l && typeof l === 'object' && l !== null) {
              const name = l.name || l.location || '';
              return typeof name === 'string' ? name.trim() : '';
            }
            return '';
          })
          .filter((loc: string): loc is string => typeof loc === 'string' && loc.length > 0);
        const people = p.parsed.people || [];
        const orgs = p.parsed.organizations || [];
        const schemes = p.parsed.schemes || [];
        
        return {
          id: p.id,
          ts: p.timestamp,
          when: formatHindiDate(p.timestamp),
          where: locations,
          what: [p.parsed.event_type],
          which: {
            mentions: people,
            hashtags: [...orgs, ...schemes],
          },
          schemes: schemes,
          how: p.content,
          confidence: p.parsed.confidence,
          needs_review: p.needs_review,
          review_status: p.review_status,
        };
      }
      
      // Fallback for unparsed data
      return {
        id: p.id,
        ts: p.timestamp,
        when: formatHindiDate(p.timestamp),
        where: [] as string[],
        what: [] as string[],
        which: { mentions: [] as string[], hashtags: [] as string[] },
        schemes: [],
        how: p.content,
      };
    });
}

export const sanitizeData = (filtered: any[]) => {
    return filtered.map((row: any) => {
        // Ensure where is always string[]
        const where: string[] = Array.isArray(row.where) 
          ? row.where.map((w: any) => {
              if (typeof w === 'string') return w;
              if (w && typeof w === 'object' && w !== null) {
                const name = w.name || w.location || '';
                return typeof name === 'string' ? name.trim() : '';
              }
              return '';
            }).filter((loc: string): loc is string => typeof loc === 'string' && loc.length > 0)
          : [];
        
        // Ensure what is always string[]
        const what: string[] = Array.isArray(row.what)
          ? row.what.map((w: any) => {
              if (typeof w === 'string') return w;
              if (w && typeof w === 'object' && w !== null) {
                const name = w.name || '';
                return typeof name === 'string' ? name.trim() : '';
              }
              return '';
            }).filter((evt: string): evt is string => typeof evt === 'string' && evt.length > 0)
          : [];
        
        // Ensure how is always string
        const how: string = typeof row.how === 'string' ? row.how : String(row.how || '');
        
        // Ensure when is always string
        const when: string = typeof row.when === 'string' ? row.when : String(row.when || '');
        
        // Ensure which.mentions and hashtags are string[]
        const mentions: string[] = Array.isArray(row.which?.mentions)
          ? row.which.mentions.map((m: any) => {
              if (typeof m === 'string') return m;
              return String(m || '');
            }).filter((m: string): m is string => typeof m === 'string' && m.length > 0)
          : [];
        const hashtags: string[] = Array.isArray(row.which?.hashtags)
          ? row.which.hashtags.map((h: any) => {
              if (typeof h === 'string') return h;
              return String(h || '');
            }).filter((h: string): h is string => typeof h === 'string' && h.length > 0)
          : [];
        
        // Return only safe properties - don't spread ...row to avoid carrying over objects
        return {
          id: row.id,
          ts: row.ts,
          when,
          where,
          what,
          which: {
            mentions,
            hashtags
          },
          schemes: Array.isArray(row.schemes) ? row.schemes.map((s: any) => typeof s === 'string' ? s : String(s || '')).filter(Boolean) : [],
          how,
          confidence: typeof row.confidence === 'number' ? row.confidence : 0,
          needs_review: typeof row.needs_review === 'boolean' ? row.needs_review : false,
          review_status: typeof row.review_status === 'string' ? row.review_status : 'pending',
        };
      });
}
