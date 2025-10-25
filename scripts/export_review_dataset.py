#!/usr/bin/env python3
import os
import json
import csv
import sys
import psycopg2
import psycopg2.extras


def main() -> int:
    out_json = sys.argv[1] if len(sys.argv) > 1 else 'data/review_dataset.json'
    out_csv = sys.argv[2] if len(sys.argv) > 2 else 'data/review_dataset.csv'
    db = os.getenv('DATABASE_URL')
    if not db:
        print('DATABASE_URL not set', file=sys.stderr)
        return 1

    conn = psycopg2.connect(db)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT pe.tweet_id,
               rt.text AS tweet_text,
               pe.event_type,
               pe.locations,
               pe.organizations,
               pe.people_mentioned,
               pe.schemes_mentioned,
               pe.review_status,
               pe.reviewed_by,
               ARRAY(SELECT t.label_hi
                     FROM tweet_tags tt
                     JOIN tags t ON t.id = tt.tag_id
                     WHERE tt.tweet_id = pe.tweet_id) AS topics
        FROM parsed_events pe
        JOIN raw_tweets rt ON rt.tweet_id = pe.tweet_id
        WHERE pe.review_status IN ('edited','approved')
        ORDER BY rt.created_at DESC
        """
    )
    rows = cur.fetchall()
    cur.close(); conn.close()

    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump([dict(r) for r in rows], f, ensure_ascii=False, indent=2)

    with open(out_csv, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['tweet_id','tweet_text','event_type','locations','organizations','people','schemes','topics','review_status','reviewed_by'])
        for r in rows:
            w.writerow([
                r['tweet_id'],
                r['tweet_text'],
                r['event_type'],
                json.dumps(r.get('locations') or [], ensure_ascii=False),
                json.dumps(r.get('organizations') or [], ensure_ascii=False),
                json.dumps(r.get('people_mentioned') or [], ensure_ascii=False),
                json.dumps(r.get('schemes_mentioned') or [], ensure_ascii=False),
                json.dumps(r.get('topics') or [], ensure_ascii=False),
                r.get('review_status'),
                r.get('reviewed_by'),
            ])
    print(f'Wrote {len(rows)} rows to {out_json} and {out_csv}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())


