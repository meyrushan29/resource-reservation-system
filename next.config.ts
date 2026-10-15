import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't auto-generate AGENTS.md in the project root.
  agentRules: false,
};

export default nextConfig;
