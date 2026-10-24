import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/api/*": [
      "./.git/**",
      "./.venv/**",
      "./MyProject/**",
      "./MyProject 5.8/**",
      "./blender/output/**",
      "./data/**",
      "./screenshots/**",
      "./tests/**",
    ],
  },
};

export default nextConfig;
