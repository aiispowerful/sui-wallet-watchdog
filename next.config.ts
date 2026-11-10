import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // MemWal lazily imports @mysten/seal + @mysten/sui at runtime to build SEAL sessions; keep them as
  // plain Node packages so those dynamic imports resolve on the server (and on Vercel).
  serverExternalPackages: ["@mysten-incubation/memwal", "@mysten/seal", "@mysten/sui"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
