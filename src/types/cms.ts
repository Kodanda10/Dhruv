/**
 * CMS Types for Title Editor and Configuration Management
 */

export interface CMSTitle {
  id: number;
  key: string;
  value_hi: string;
  value_en?: string;
  section: string;
  updated_at: string;
  updated_by?: string;
  created_at: string;
}

export interface AnalyticsModule {
  id: number;
  module_key: string;
  module_name_hi: string;
  module_name_en?: string;
  enabled: boolean;
  display_order: number;
  updated_at: string;
  updated_by?: string;
  created_at: string;
}

export interface SystemConfig {
  id: number;
  config_key: string;
  config_value: Record<string, any>;
  description?: string;
  updated_at: string;
  updated_by?: string;
  created_at: string;
}

export interface CMSConfigResponse {
  success: boolean;
  data?: {
    titles?: CMSTitle[];
    modules?: AnalyticsModule[];
    config?: SystemConfig[];
  };
  error?: string;
}

export interface TitleUpdateRequest {
  key: string;
  value_hi: string;
  value_en?: string;
  section: string;
}

export interface ModuleToggleRequest {
  module_key: string;
  enabled: boolean;
}

export interface ConfigExportResponse {
  success: boolean;
  data?: {
    titles: CMSTitle[];
    modules: AnalyticsModule[];
    config: SystemConfig[];
    exported_at: string;
  };
  error?: string;
}


