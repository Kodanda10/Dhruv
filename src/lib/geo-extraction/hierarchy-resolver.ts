import fs from 'fs/promises';
import path from 'path';

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
  
  async initialize(): Promise<void> {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'chhattisgarh_geography_clean.json');
      const rawData = await fs.readFile(dataPath, 'utf-8');
      this.geographyData = JSON.parse(rawData);
      
      await this.buildIndexes();
    } catch (error) {
      console.error('Failed to initialize GeoHierarchyResolver:', error);
      throw new Error('Could not load geography data');
    }
  }
  
  async cleanup(): Promise<void> {
    this.geographyData = null;
    this.villageIndex.clear();
    this.fuzzyIndex.clear();
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
    
    const normalizedName = villageName.toLowerCase().trim();
    
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
}
