import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Condition checks upload 4-5 phone photos in one submit.
      bodySizeLimit: "20mb",
    },
  },
  async headers() {
    // Safe hardening for every page: no content-type sniffing, never shown inside someone else's frame, and no full address leaked to other sites.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
