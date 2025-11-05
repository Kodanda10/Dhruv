/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Ensure API routes are properly built
  output: 'standalone',
  // Explicitly include API routes in build
  transpilePackages: [],
  // Ensure server components work properly
  serverComponentsExternalPackages: [],
};

export default nextConfig;

