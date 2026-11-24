/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["msedge-tts"],
  // ảnh bản đồ Trái Đất thật (NASA, qua kho three.js) – cùng tên miền để không lỗi CORS khi xuất video
  async rewrites() {
    return [{ source: "/tex/:file", destination: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/:file" }];
  },
};
export default nextConfig;
