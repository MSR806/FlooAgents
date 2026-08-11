/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.30.140"],
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
