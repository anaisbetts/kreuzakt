import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@kreuzberg/node",
    "@kreuzberg/node-darwin-arm64",
    "@kreuzberg/node-linux-arm64-gnu",
    "@kreuzberg/node-linux-x64-gnu",
    "@kreuzberg/node-win32-x64-msvc",
    "chokidar",
    "sharp",
  ],
};

export default nextConfig;
