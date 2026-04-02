import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "bcryptjs"],
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
