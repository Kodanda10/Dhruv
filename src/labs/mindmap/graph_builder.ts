/**
 * Mindmap Graph Builder
 * 
 * Builds graph from real analytics data:
 * - Nodes: Topics/Tags, Locations, Entities (People/Orgs), Event Types
 * - Edges: Co-occurrence above threshold in approved tweets
 */

import { getDbPool } from '@/lib/db/pool';

export interface GraphNode {
  id: string;
  label: string;
  type: 'topic' | 'location' | 'person' | 'organization' | 'event_type';
  size: number;
  centrality?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  cooccurrence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    node_count: number;
    edge_count: number;
    build_time_ms: number;
  };
}

/**
 * Build graph from analytics data
 */
export async function buildGraph(threshold: number = 2): Promise<GraphData> {
  const startTime = Date.now();
  const pool = getDbPool();

  try {
    // Fetch approved events with all entities
    const result = await pool.query(`
      SELECT 
        pe.event_type,
        pe.locations,
        pe.people_mentioned,
        pe.organizations,
        pe.schemes_mentioned
      FROM parsed_events pe
      WHERE pe.review_status IN ('approved', 'edited')
        AND pe.event_type IS NOT NULL
      LIMIT 500
    `);

    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();

    // Process each event to extract nodes and co-occurrences
    for (const row of result.rows) {
      const eventType = row.event_type;
      const locations = Array.isArray(row.locations) ? row.locations : [];
      const people = Array.isArray(row.people_mentioned) ? row.people_mentioned : [];
      const orgs = Array.isArray(row.organizations) ? row.organizations : [];
      const schemes = Array.isArray(row.schemes_mentioned) ? row.schemes_mentioned : [];

      // Add event type node
      if (eventType) {
        const nodeId = `event_type:${eventType}`;
        if (!nodes.has(nodeId)) {
          nodes.set(nodeId, {
            id: nodeId,
            label: eventType,
            type: 'event_type',
            size: 1,
          });
        } else {
          nodes.get(nodeId)!.size++;
        }
      }

      // Add location nodes
      for (const loc of locations) {
        const locName = typeof loc === 'string' ? loc : (loc.name || loc.name_en || '');
        if (locName) {
          const nodeId = `location:${locName}`;
          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              label: locName,
              type: 'location',
              size: 1,
            });
          } else {
            nodes.get(nodeId)!.size++;
          }

          // Create edge between event type and location
          if (eventType) {
            const edgeKey = `event_type:${eventType}-location:${locName}`;
            if (!edges.has(edgeKey)) {
              edges.set(edgeKey, {
                source: `event_type:${eventType}`,
                target: nodeId,
                weight: 1,
                cooccurrence: 1,
              });
            } else {
              const edge = edges.get(edgeKey)!;
              edge.weight++;
              edge.cooccurrence++;
            }
          }
        }
      }

      // Add people nodes
      for (const person of people) {
        if (person) {
          const nodeId = `person:${person}`;
          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              label: person,
              type: 'person',
              size: 1,
            });
          } else {
            nodes.get(nodeId)!.size++;
          }

          // Create edges
          if (eventType) {
            const edgeKey = `event_type:${eventType}-person:${person}`;
            if (!edges.has(edgeKey)) {
              edges.set(edgeKey, {
                source: `event_type:${eventType}`,
                target: nodeId,
                weight: 1,
                cooccurrence: 1,
              });
            } else {
              const edge = edges.get(edgeKey)!;
              edge.weight++;
              edge.cooccurrence++;
            }
          }
        }
      }

      // Add organization nodes
      for (const org of orgs) {
        if (org) {
          const nodeId = `organization:${org}`;
          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              label: org,
              type: 'organization',
              size: 1,
            });
          } else {
            nodes.get(nodeId)!.size++;
          }
        }
      }
    }

    // Filter edges by threshold
    const filteredEdges = Array.from(edges.values()).filter(
      (edge) => edge.cooccurrence >= threshold
    );

    // Calculate centrality (simple degree centrality)
    const centralityMap = new Map<string, number>();
    for (const edge of filteredEdges) {
      centralityMap.set(edge.source, (centralityMap.get(edge.source) || 0) + 1);
      centralityMap.set(edge.target, (centralityMap.get(edge.target) || 0) + 1);
    }

    // Update nodes with centrality
    const nodeArray = Array.from(nodes.values());
    for (const node of nodeArray) {
      node.centrality = centralityMap.get(node.id) || 0;
    }

    const buildTime = Date.now() - startTime;

    return {
      nodes: nodeArray,
      edges: filteredEdges,
      stats: {
        node_count: nodeArray.length,
        edge_count: filteredEdges.length,
        build_time_ms: buildTime,
      },
    };
  } catch (error) {
    console.error('Failed to build graph:', error);
    throw error;
  }
}

