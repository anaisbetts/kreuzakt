import type { NextConfig } from "next";

const isDevMode = !!process.env.npm_command;
const devConfig: Partial<NextConfig> = {
  allowedDevOrigins: process.env.DEV_ORIGIN ? [process.env.DEV_ORIGIN] : [],
};

const nextConfig: NextConfig = {
  allowedDevOrigins: ["enceladus"],
  serverExternalPackages: ["@modelcontextprotocol/sdk", "chokidar", "sharp"],
  ...(isDevMode ? devConfig : {}),
  output: "standalone",
};

export default nextConfig;
