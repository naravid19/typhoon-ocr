import type { NextConfig } from "next";
import { readFileSync } from "fs";
import path from "path";

// The app version is the root package.json version (bumped at each release); read once at startup.
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/ocr",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
