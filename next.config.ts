import type { NextConfig } from "next";

const isDevMode = !!process.env.npm_command;
const devConfig: Partial<NextConfig> = {
  allowedDevOrigins: process.env.DEV_ORIGIN ? [process.env.DEV_ORIGIN] : [],
};

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
  ...(isDevMode ? devConfig : {}),
  output: "standalone",
};

export default nextConfig;
