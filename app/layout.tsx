import type { Metadata } from "next";
import { codexiaAssets } from "@/lib/design-system/assets";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codexia — Local AI coding workspace",
  description: "A local mini-Cursor powered by Ollama.",
  icons: {
    icon: [
      { url: codexiaAssets.icons.favicon16, sizes: "16x16", type: "image/png" },
      { url: codexiaAssets.icons.favicon32, sizes: "32x32", type: "image/png" },
      { url: codexiaAssets.icons.favicon48, sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: codexiaAssets.icons.appleTouch, sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
