/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
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
