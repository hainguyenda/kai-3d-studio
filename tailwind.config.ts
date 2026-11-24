import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { studio: { bg: "#0f1117", card: "#171a23", line: "#2a2f3c", accent: "#e67e22", muted: "#9aa0ab" } } } },
  plugins: [],
};
export default config;
