import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external devices on the local Wi-Fi to load the app assets
  allowedDevOrigins: ['192.168.1.191', '127.0.0.1', 'localhost'],
};

export default nextConfig;