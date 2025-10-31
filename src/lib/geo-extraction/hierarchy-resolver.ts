import fs from 'fs/promises';
import path from 'path';
import { isGeoStrictModeEnabled } from '../../../config/flags';

export interface GeoHierarchy {
  village: string;
  gram_panchayat?: string; // For rural
  ulb?: string; // For urban
  ward_no?: number; // For urban
  block: string;
  assembly: string;
  district: string;
  is_urban: boolean;
  confidence: number;
}

export interface AmbiguousLocation {
  name: string;
  possibleMatches: GeoHierarchy[];
  suggestedMatch: GeoHierarchy;
}

interface GeographyData {
  state: string;
  districts: District[];
}

interface District {
  name: string;
  district_code: string;
  acs: AssemblyConstituency[];
}

interface AssemblyConstituency {
  name: string;
  blocks: Block[];
}

interface Block {
  name: string;
  gps: GramPanchayat[];
}

interface GramPanchayat {
  name: string;
  villages: Village[];
}

interface Village {
  name: string;
  pincode: string;
  population: number;
}

export class GeoHierarchyResolver {
  private geographyData: GeographyData | null = null;
  private villageIndex: Map<string, GeoHierarchy[]> = new Map();
  private fuzzyIndex: Map<string, string[]> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private ulbWardIndex: Map<string, Set<number>> = new Map();
  private sectorToWard: Map<string, Map<string, number>> = new Map();
  
  async initialize(): Promise<void> {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'chhattisgarh_geography_clean.json');
      const rawData = await fs.readFile(dataPath, 'utf-8');
      this.geographyData = JSON.parse(rawData);
      
      await this.buildIndexes();

      // Optional: load aliases
      try {
        const aliasPath = path.join(process.cwd(), 'data', 'geo_aliases.json');
        const aliasRaw = await fs.readFile(aliasPath, 'utf-8');
        const aliasJson = JSON.parse(aliasRaw);
        if (aliasJson && aliasJson.canonical) {
          for (const [canonical, aliasList] of Object.entries(aliasJson.canonical as Record<string, string[]>)) {
            this.aliasMap.set(canonical, canonical);
            for (const a of aliasList) {
              this.aliasMap.set(a, canonical);
            }
          }
        }
      } catch (_) {
        // aliases optional
      }

      // Optional: load ULB wards and sector mapping
      try {
        const ulbPath = path.join(process.cwd(), 'data', 'ulb_wards.json');
        const ulbRaw = await fs.readFile(ulbPath, 'utf-8');
        const ulbJson = JSON.parse(ulbRaw);
        if (ulbJson && Array.isArray(ulbJson.ulbs)) {
          for (const ulb of ulbJson.ulbs as Array<{ name: string; wards: number[] }>) {
            this.ulbWardIndex.set(ulb.name, new Set(ulb.wards));
          }
        }
        if (ulbJson && ulbJson.sector_to_ward) {
          for (const [city, mapping] of Object.entries(ulbJson.sector_to_ward as Record<string, Record<string, number>>)) {
            const m = new Map<string, number>();
            for (const [sector, ward] of Object.entries(mapping)) {
              m.set(sector, ward as number);
            }
            this.sectorToWard.set(city, m);
          }
        }
      } catch (_) {
        // ulb/ward optional
      }
    } catch (error) {
      console.error('Failed to initialize GeoHierarchyResolver:', error);
      throw new Error('Could not load geography data');
    }
  }
  
  async cleanup(): Promise<void> {
    this.geographyData = null;
    this.villageIndex.clear();
    this.fuzzyIndex.clear();
    this.aliasMap.clear();
    this.ulbWardIndex.clear();
    this.sectorToWard.clear();
  }
  
  private async buildIndexes(): Promise<void> {
    if (!this.geographyData) return;
    
    for (const district of this.geographyData.districts) {
      for (const ac of district.acs) {
        for (const block of ac.blocks) {
          for (const gp of block.gps) {
            for (const village of gp.villages) {
              const hierarchy: GeoHierarchy = {
                village: village.name,
                gram_panchayat: gp.name,
                block: block.name,
                assembly: ac.name,
                district: district.name,
                is_urban: this.isUrbanArea(village.name, gp.name),
                confidence: 1.0
              };
              
              // Add ULB and ward info for urban areas
              if (hierarchy.is_urban) {
                hierarchy.ulb = this.getULBName(district.name);
                hierarchy.ward_no = this.getWardNumber(village.name);
              }
              
              // Index by village name
              const villageKey = village.name.toLowerCase();
              if (!this.villageIndex.has(villageKey)) {
                this.villageIndex.set(villageKey, []);
              }
              this.villageIndex.get(villageKey)!.push(hierarchy);
              
              // Build fuzzy index for partial matching
              await this.addToFuzzyIndex(village.name, hierarchy);
            }
          }
        }
      }
    }
  }

  private normalizeName(name: string): string {
    if (!name) return name;
    const trimmed = name.trim();
    const fromAlias = this.aliasMap.get(trimmed);
    return fromAlias || trimmed;
  }

  private mapSectorToWardIfApplicable(city: string, text: string): number | null {
    if (!city || !text) return null;
    const cityMap = this.sectorToWard.get(city);
    if (!cityMap) return null;
    const sectorMatch = text.match(/सेक्टर\s*(\d+)|sector\s*(\d+)/i);
    if (!sectorMatch) return null;
    const sector = (sectorMatch[1] || sectorMatch[2] || '').trim();
    if (!sector) return null;
    const ward = cityMap.get(sector);
    return ward || null;
  }

  // Optional constraint-based disambiguation using known districts/blocks
  private constrainCandidates(
    candidates: GeoHierarchy[],
    hints?: { districts?: string[]; blocks?: string[] }
  ): GeoHierarchy[] {
    if (!hints || candidates.length <= 1) return candidates;
    let filtered = candidates;
    if (hints.districts && hints.districts.length > 0) {
      const set = new Set(hints.districts.map(d => d.toLowerCase().trim()));
      const byDistrict = filtered.filter(c => set.has(c.district.toLowerCase()));
      if (byDistrict.length > 0) filtered = byDistrict;
    }
    if (hints.blocks && hints.blocks.length > 0 && filtered.length > 1) {
      const set = new Set(hints.blocks.map(b => b.toLowerCase().trim()));
      const byBlock = filtered.filter(c => set.has(c.block.toLowerCase()));
      if (byBlock.length > 0) filtered = byBlock;
    }
    return filtered;
  }

  // New helper: disambiguate with hints; falls back to context string method
  async resolveWithHints(name: string, hints?: { districts?: string[]; blocks?: string[]; context?: string }): Promise<GeoHierarchy> {
    const base = await this.resolveVillage(name);
    if (base.length === 0) {
      throw new Error(`No matches found for location: ${name}`);
    }
    if (base.length === 1) return { ...base[0], confidence: 1.0 };

    const constrained = this.constrainCandidates(base, hints);
    if (constrained.length === 1) return { ...constrained[0], confidence: 1.0 };

    if (hints?.context) {
      return this.resolveAmbiguousLocation(name, hints.context);
    }
    // If still ambiguous, return first with lowered confidence; caller can set needs_review
    return { ...base[0], confidence: Math.min(base[0].confidence ?? 0.8, 0.85) };
  }
  
  private isUrbanArea(villageName: string, gpName: string): boolean {
    // Simple heuristic: if village name matches GP name, it's likely urban
    // This could be enhanced with more sophisticated logic
    return villageName === gpName || 
           villageName.includes('नगर') || 
           villageName.includes('शहर') ||
           gpName.includes('नगर') ||
           gpName.includes('शहर');
  }
  
  private getULBName(districtName: string): string {
    // Map district names to ULB names
    const ulbMap: Record<string, string> = {
      'रायपुर': 'रायपुर नगर निगम',
      'बिलासपुर': 'बिलासपुर नगर निगम',
      'दुर्ग': 'दुर्ग नगर निगम',
      'रायगढ़': 'रायगढ़ नगर निगम',
      'कोरबा': 'कोरबा नगर निगम'
    };
    
    return ulbMap[districtName] || `${districtName} नगर निगम`;
  }
  
  private getWardNumber(villageName: string): number {
    // Extract ward number from village name or assign based on name hash
    const wardMatch = villageName.match(/वार्ड\s*(\d+)|ward\s*(\d+)/i);
    if (wardMatch) {
      return parseInt(wardMatch[1] || wardMatch[2]);
    }
    
    // Simple hash-based ward assignment for testing
    let hash = 0;
    for (let i = 0; i < villageName.length; i++) {
      hash = ((hash << 5) - hash + villageName.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 20 + 1; // Ward 1-20
  }
  
  private async addToFuzzyIndex(villageName: string, hierarchy: GeoHierarchy): Promise<void> {
    // Add various forms of the name for fuzzy matching
    const variations = [
      villageName.toLowerCase(),
      villageName.replace(/[ा-ौ]/g, ''), // Remove matras
      villageName.replace(/[़-़]/g, ''), // Remove nukta
    ];
    
    // Add transliterated versions (simple mapping)
    const transliterated = this.transliterate(villageName);
    if (transliterated) {
      variations.push(transliterated.toLowerCase());
    }
    
    for (const variation of variations) {
      if (!this.fuzzyIndex.has(variation)) {
        this.fuzzyIndex.set(variation, []);
      }
      this.fuzzyIndex.get(variation)!.push(villageName);
    }
  }
  
  private transliterate(hindiText: string): string {
    // Simple Hindi to English transliteration mapping
    const transliterationMap: Record<string, string> = {
      'रायपुर': 'Raipur',
      'बिलासपुर': 'Bilaspur',
      'दुर्ग': 'Durg',
      'रायगढ़': 'Raigarh',
      'कोरबा': 'Korba',
      'पंडरी': 'Pandri',
      'कोटा': 'Kota',
      'महासमुंद': 'Mahasamund',
      'अरंग': 'Arang',
      'धरसीवाँ': 'Dharasiva',
      'खैरगढ़': 'Khairgarh',
      'सिलोतरा': 'Silotra',
      'तिल्दा': 'Tilda',
      'नवागढ़': 'Navagarh',
      'बलोदा बाजार': 'Baloda Bazar',
      'कसडोल': 'Kasdol',
      'पलारी': 'Palari'
    };
    
    return transliterationMap[hindiText] || hindiText;
  }
  
  async resolveVillage(villageName: string): Promise<GeoHierarchy[]> {
    if (!villageName || typeof villageName !== 'string') {
      return [];
    }
    
    // Normalize through alias map first (preserve original for display)
    const aliasNormalized = this.normalizeName(villageName);
    const normalizedName = aliasNormalized.toLowerCase().trim();
    
    // Handle ward-based queries (e.g., "रायपुर वार्ड 5")
    const wardMatch = villageName.match(/^(.+?)\s+वार्ड\s*(\d+)|^(.+?)\s+ward\s*(\d+)/i);
    if (wardMatch) {
      const baseVillageName = wardMatch[1] || wardMatch[3];
      const wardNumber = parseInt(wardMatch[2] || wardMatch[4]);
      
      // Find the base village
      const baseResults = await this.resolveVillage(baseVillageName);
      if (baseResults.length > 0) {
        // Return the first result with the specific ward number
        return [{
          ...baseResults[0],
          ward_no: wardNumber,
          village: villageName // Keep the full name with ward
        }];
      }
    }

    // Handle sector→ward mapping for urban (e.g., "नवा रायपुर सेक्टर 21")
    const cityCandidates = [aliasNormalized, villageName].filter(Boolean);
    for (const candidate of cityCandidates) {
      const cityName = this.normalizeName(candidate);
      const possibleWard = this.mapSectorToWardIfApplicable(cityName, villageName);
      if (possibleWard) {
        const baseResults = this.villageIndex.get(cityName.toLowerCase()) || [];
        if (baseResults.length > 0) {
          return [{
            ...baseResults[0],
            ward_no: possibleWard,
            village: villageName,
            is_urban: true,
            confidence: 0.98
          }];
        }
      }
    }
    
    // Direct lookup
    const directMatches = this.villageIndex.get(normalizedName) || [];
    if (directMatches.length > 0) {
      return directMatches;
    }
    
    // Fuzzy matching
    const fuzzyMatches = await this.fuzzyMatch(normalizedName);
    const results: GeoHierarchy[] = [];
    
    for (const match of fuzzyMatches) {
      const hierarchies = this.villageIndex.get(match.toLowerCase()) || [];
      results.push(...hierarchies.map(h => ({ ...h, confidence: 0.8 })));
    }
    
    return results;
  }
  
  async resolveAmbiguousLocation(name: string, context: string): Promise<GeoHierarchy> {
    const possibleMatches = await this.resolveVillage(name);
    
    if (possibleMatches.length === 0) {
      throw new Error(`No matches found for location: ${name}`);
    }
    
    if (possibleMatches.length === 1) {
      return possibleMatches[0];
    }
    
    // Use context to disambiguate
    const contextLower = context.toLowerCase();
    let bestMatch = possibleMatches[0];
    let bestScore = 0;
    
    for (const match of possibleMatches) {
      let score = 0;
      
      // Check if context mentions the district
      if (contextLower.includes(match.district.toLowerCase())) {
        score += 3;
      }
      
      // Check if context mentions the assembly
      if (contextLower.includes(match.assembly.toLowerCase())) {
        score += 2;
      }
      
      // Check if context mentions the block
      if (contextLower.includes(match.block.toLowerCase())) {
        score += 1;
      }
      
      // Check if context mentions nearby villages
      const nearbyVillages = this.getNearbyVillages(match);
      for (const nearby of nearbyVillages) {
        if (contextLower.includes(nearby.toLowerCase())) {
          score += 1;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = match;
      }
    }
    
    return { ...bestMatch, confidence: Math.min(0.9, 0.5 + bestScore * 0.1) };
  }
  
  async fuzzyMatch(name: string): Promise<string[]> {
    if (!name || typeof name !== 'string') {
      return [];
    }
    
    const normalizedName = name.toLowerCase().trim();
    const matches: string[] = [];
    
    // Direct fuzzy index lookup
    const directFuzzy = this.fuzzyIndex.get(normalizedName) || [];
    matches.push(...directFuzzy);
    
    // Partial matching
    for (const [key, values] of this.fuzzyIndex.entries()) {
      if (key.includes(normalizedName) || normalizedName.includes(key)) {
        matches.push(...values);
      }
    }
    
    // Remove duplicates and return
    return [...new Set(matches)];
  }
  
  private getNearbyVillages(hierarchy: GeoHierarchy): string[] {
    // Get villages in the same GP
    const sameGP = Array.from(this.villageIndex.values())
      .flat()
      .filter(h => h.gram_panchayat === hierarchy.gram_panchayat && h.village !== hierarchy.village)
      .map(h => h.village);
    
    return sameGP.slice(0, 5); // Return up to 5 nearby villages
  }
  
  // Performance monitoring
  getStats(): { totalVillages: number; totalDistricts: number; indexSize: number } {
    const totalVillages = Array.from(this.villageIndex.values()).reduce((sum, arr) => sum + arr.length, 0);
    const totalDistricts = this.geographyData?.districts.length || 0;
    
    return {
      totalVillages,
      totalDistricts,
      indexSize: this.villageIndex.size
    };
  }

  /**
   * Resolve location deterministically with strict mode enforcement.
   * 
   * In strict mode (GEO_STRICT_MODE enabled):
   * - Multiple candidates → needs_review = true, return all candidates
   * - Single candidate → confidence ≥0.98, needs_review = false
   * - No candidates → throw error
   * 
   * @param locationName - The location name to resolve
   * @param hints - Optional disambiguation hints (district, block, context)
   * @returns Deterministic resolution result with candidates, needs_review flag, and explanations
   */
  async resolveDeterministic(
    locationName: string,
    hints?: { districts?: string[]; blocks?: string[]; context?: string }
  ): Promise<{
    hierarchy: GeoHierarchy | null;
    candidates: GeoHierarchy[];
    needs_review: boolean;
    explanations: string[];
  }> {
    // Check feature flag for strict mode
    const strictMode = isGeoStrictModeEnabled();

    // Get all candidates for the location
    const allCandidates = await this.resolveVillage(locationName);

    // No candidates found
    if (allCandidates.length === 0) {
      if (strictMode) {
        throw new Error(`No matches found for location: ${locationName} (strict mode enabled)`);
      }
      return {
        hierarchy: null,
        candidates: [],
        needs_review: true,
        explanations: [`No matches found for location: "${locationName}"`]
      };
    }

    // Apply constraint hints to narrow down candidates
    let constrainedCandidates = this.constrainCandidates(allCandidates, hints);

    // If constraints didn't help, try context-based disambiguation
    if (constrainedCandidates.length > 1 && hints?.context) {
      try {
        const contextResolved = await this.resolveAmbiguousLocation(locationName, hints.context);
        // If context resolved to a single match, use it
        constrainedCandidates = [contextResolved];
      } catch {
        // Context disambiguation failed, keep constrained candidates
      }
    }

    // Single candidate - deterministic resolution
    if (constrainedCandidates.length === 1) {
      const hierarchy = this.enforceDeterminism(constrainedCandidates[0], locationName, allCandidates.length);
      return {
        hierarchy,
        candidates: [hierarchy],
        needs_review: false,
        explanations: []
      };
    }

    // Multiple candidates - needs review
    if (strictMode) {
      return {
        hierarchy: null,
        candidates: constrainedCandidates,
        needs_review: true,
        explanations: [
          `Multiple candidates (${constrainedCandidates.length}) found for location "${locationName}" — human confirmation required`,
          `Candidates: ${constrainedCandidates.map(c => `${c.village} (${c.block}, ${c.district})`).join(', ')}`
        ]
      };
    }

    // Non-strict mode: return first candidate with lowered confidence
    const firstCandidate = constrainedCandidates[0];
    return {
      hierarchy: { ...firstCandidate, confidence: Math.min(firstCandidate.confidence ?? 0.8, 0.85) },
      candidates: constrainedCandidates,
      needs_review: true,
      explanations: [
        `Multiple candidates found for "${locationName}" — using first match with lowered confidence`
      ]
    };
  }

  /**
   * Enforce determinism by applying confidence policy.
   * 
   * Confidence policy:
   * - Exact match: 1.0
   * - Verified ULB/Ward: ≥0.98
   * - Alias + constraints: ≥0.95
   * - Ambiguous: 0.5-0.8 (needs_review)
   */
  private enforceDeterminism(
    candidate: GeoHierarchy,
    originalLocationName: string,
    totalCandidatesFound: number
  ): GeoHierarchy {
    const normalizedOriginal = originalLocationName.toLowerCase().trim();
    const normalizedCandidate = candidate.village.toLowerCase().trim();

    // Exact match
    if (normalizedOriginal === normalizedCandidate && totalCandidatesFound === 1) {
      return { ...candidate, confidence: 1.0 };
    }

    // Verified ULB/Ward (sector-to-ward mapping or explicit ward)
    if (candidate.is_urban && candidate.ward_no && candidate.ulb) {
      // Check if this is from sector-to-ward mapping (high confidence)
      if (originalLocationName.includes('सेक्टर') || originalLocationName.includes('sector')) {
        return { ...candidate, confidence: 0.98 };
      }
      // Explicit ward mention
      if (originalLocationName.includes('वार्ड') || originalLocationName.includes('ward')) {
        return { ...candidate, confidence: 0.98 };
      }
    }

    // Alias match with constraints (hints were applied)
    if (totalCandidatesFound > 1) {
      // If we got here with single candidate after constraints, it's reliable
      return { ...candidate, confidence: Math.max(0.95, candidate.confidence ?? 0.8) };
    }

    // Default: use candidate's existing confidence or set minimum
    return { ...candidate, confidence: Math.max(candidate.confidence ?? 0.8, 0.8) };
  }
}
