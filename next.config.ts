import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sql.js ships a .wasm file; keep it out of the server bundle.
  serverExternalPackages: ["sql.js", "web-push"],
};

export default nextConfig;
