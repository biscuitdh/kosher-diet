/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const distDir = process.env.NEXT_DIST_DIR || ".next";
const outputFileTracingRoot = process.env.NEXT_OUTPUT_TRACING_ROOT || undefined;
const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()"
  }
];

const nextConfig = {
  distDir,
  outputFileTracingRoot,
  output: isStaticExport ? "export" : "standalone",
  basePath: basePath || undefined,
  assetPrefix: isStaticExport && basePath ? basePath : undefined,
  images: {
    unoptimized: isStaticExport
  },
  devIndicators: false,
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: isStaticExport,
  ...(isStaticExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: securityHeaders
            }
          ];
        }
      })
};

export default nextConfig;
