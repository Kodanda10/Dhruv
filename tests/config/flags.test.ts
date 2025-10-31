import { isGeoStrictModeEnabled } from '../../config/flags';

describe('isGeoStrictModeEnabled', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear both env vars
    delete process.env.NEXT_PUBLIC_GEO_STRICT_MODE;
    delete process.env.GEO_STRICT_MODE;
    delete process.env.NODE_ENV;
    delete process.env.VERCEL_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('explicit true values', () => {
    it('should return true when NEXT_PUBLIC_GEO_STRICT_MODE is "true"', () => {
      process.env.NEXT_PUBLIC_GEO_STRICT_MODE = 'true';
      expect(isGeoStrictModeEnabled()).toBe(true);
    });

    it('should return true when NEXT_PUBLIC_GEO_STRICT_MODE is "1"', () => {
      process.env.NEXT_PUBLIC_GEO_STRICT_MODE = '1';
      expect(isGeoStrictModeEnabled()).toBe(true);
    });

    it('should return true when GEO_STRICT_MODE is "true"', () => {
      process.env.GEO_STRICT_MODE = 'true';
      expect(isGeoStrictModeEnabled()).toBe(true);
    });

    it('should prefer NEXT_PUBLIC_GEO_STRICT_MODE over GEO_STRICT_MODE', () => {
      process.env.NEXT_PUBLIC_GEO_STRICT_MODE = 'true';
      process.env.GEO_STRICT_MODE = 'false';
      expect(isGeoStrictModeEnabled()).toBe(true);
    });
  });

  describe('explicit false values', () => {
    it('should return false when NEXT_PUBLIC_GEO_STRICT_MODE is "false"', () => {
      process.env.NEXT_PUBLIC_GEO_STRICT_MODE = 'false';
      expect(isGeoStrictModeEnabled()).toBe(false);
    });

    it('should return false when NEXT_PUBLIC_GEO_STRICT_MODE is "0"', () => {
      process.env.NEXT_PUBLIC_GEO_STRICT_MODE = '0';
      expect(isGeoStrictModeEnabled()).toBe(false);
    });

    it('should return false when GEO_STRICT_MODE is "false"', () => {
      process.env.GEO_STRICT_MODE = 'false';
      expect(isGeoStrictModeEnabled()).toBe(false);
    });
  });

  describe('default behavior (when env vars not set)', () => {
    it('should return true in development (NODE_ENV not production)', () => {
      process.env.NODE_ENV = 'development';
      expect(isGeoStrictModeEnabled()).toBe(true);
    });

    it('should return false in production (NODE_ENV=production)', () => {
      process.env.NODE_ENV = 'production';
      expect(isGeoStrictModeEnabled()).toBe(false);
    });

    it('should return false when VERCEL_ENV=production', () => {
      process.env.VERCEL_ENV = 'production';
      expect(isGeoStrictModeEnabled()).toBe(false);
    });

    it('should return true when NODE_ENV is undefined (defaults to dev)', () => {
      delete process.env.NODE_ENV;
      delete process.env.VERCEL_ENV;
      expect(isGeoStrictModeEnabled()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as false', () => {
      process.env.NEXT_PUBLIC_GEO_STRICT_MODE = '';
      // Empty string should fall through to default check
      process.env.NODE_ENV = 'development';
      expect(isGeoStrictModeEnabled()).toBe(true);
    });

    it('should handle invalid values as false', () => {
      process.env.NEXT_PUBLIC_GEO_STRICT_MODE = 'invalid';
      process.env.NODE_ENV = 'production';
      expect(isGeoStrictModeEnabled()).toBe(false);
    });
  });
});
