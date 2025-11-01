-- Project Dhruv Postgres Schema Initialization
-- This script sets up the database schema for SOTA datasets

-- Create schema for dims
CREATE SCHEMA IF NOT EXISTS dims;

-- Geography dimension table
CREATE TABLE IF NOT EXISTS dims.dim_geography (
    id SERIAL PRIMARY KEY,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    ac VARCHAR(100),
    block VARCHAR(100),
    gp VARCHAR(100),
    village VARCHAR(100),
    pincode VARCHAR(10),
    lat DECIMAL(10, 7),
    lon DECIMAL(10, 7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint for geography hierarchy
ALTER TABLE dims.dim_geography ADD CONSTRAINT uk_dim_geography_hierarchy UNIQUE (state, district, village);

-- Festival dimension table
CREATE TABLE IF NOT EXISTS dims.dim_festival (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50), -- lunar or solar
    month VARCHAR(50),
    day VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint for festival name
ALTER TABLE dims.dim_festival ADD CONSTRAINT uk_dim_festival_name UNIQUE (name);

-- Festival dates table (many-to-many with years)
CREATE TABLE IF NOT EXISTS dims.dim_festival_dates (
    id SERIAL PRIMARY KEY,
    festival_id INTEGER REFERENCES dims.dim_festival(id),
    year INTEGER NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- POI dimension table
CREATE TABLE IF NOT EXISTS dims.dim_poi (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50), -- temple, venue, etc.
    lat DECIMAL(10, 7),
    lon DECIMAL(10, 7),
    address TEXT,
    osm_id VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint for POI name and type
ALTER TABLE dims.dim_poi ADD CONSTRAINT uk_dim_poi_name_type UNIQUE (name, type);

-- Schemes dimension table
CREATE TABLE IF NOT EXISTS dims.dim_schemes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50), -- state or central
    department VARCHAR(200),
    eligibility JSONB,
    benefits JSONB,
    application_process JSONB,
    contact JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint for schemes name
ALTER TABLE dims.dim_schemes ADD CONSTRAINT uk_dim_schemes_name UNIQUE (name);

-- Index for schemes table
CREATE INDEX IF NOT EXISTS idx_dim_schemes_name ON dims.dim_schemes(name);
CREATE INDEX IF NOT EXISTS idx_dim_schemes_type ON dims.dim_schemes(type);

-- Fact event table (placeholder for parsed events)
CREATE TABLE IF NOT EXISTS facts.fact_event (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    parsed_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bridges for relationships (e.g., event to geography)
CREATE TABLE IF NOT EXISTS bridges.bridge_event_geography (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES facts.fact_event(id),
    geography_id INTEGER REFERENCES dims.dim_geography(id),
    confidence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dim_geography_state ON dims.dim_geography(state);
CREATE INDEX IF NOT EXISTS idx_dim_geography_district ON dims.dim_geography(district);
CREATE INDEX IF NOT EXISTS idx_dim_poi_type ON dims.dim_poi(type);
CREATE INDEX IF NOT EXISTS idx_fact_event_created_at ON facts.fact_event(created_at);
CREATE INDEX IF NOT EXISTS idx_bridge_event_geography_event ON bridges.bridge_event_geography(event_id);
CREATE INDEX IF NOT EXISTS idx_bridge_event_geography_geo ON bridges.bridge_event_geography(geography_id);

-- Create facts schema if not exists
CREATE SCHEMA IF NOT EXISTS facts;
CREATE SCHEMA IF NOT EXISTS bridges;
