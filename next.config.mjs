/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const distDir = process.env.NEXT_DIST_DIR || ".next";
const outputFileTracingRoot = process.env.NEXT_OUTPUT_TRACING_ROOT || undefined;

const nextConfig = {
  distDir,
  outputFileTracingRoot,
  output: isStaticExport ? "export" : "standalone",
  basePath: basePath || undefined,
  assetPrefix: isStaticExport && basePath ? basePath : undefined,
  images: {
    unoptimized: isStaticExport
  },
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: isStaticExport
};

export default nextConfig;
