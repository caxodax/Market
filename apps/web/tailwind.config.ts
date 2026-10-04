import type { Config } from "tailwindcss";
import sharedConfig from "@marketos/ui/tailwind.config";

const config: Pick<Config, "prefix" | "presets" | "content"> = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  presets: [sharedConfig as Config],
};

export default config;
