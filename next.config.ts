import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["unpdf", "exceljs"],
  allowedDevOrigins: ["100.71.29.61"],
  async rewrites() {
    return [
      // Proxy all /api/* requests to backend EXCEPT /api/auth/*
      {
        source: "/api/:path((?!auth).*)",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
