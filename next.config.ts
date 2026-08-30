import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Condition checks upload 4-5 phone photos in one submit.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
