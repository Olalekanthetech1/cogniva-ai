import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/globals.css";

export const metadata: Metadata = {
  applicationName: "Cogniva",
  title: {
    default: "Cogniva — Understand More. Think Better.",
    template: "%s | Cogniva"
  },
  description:
    "An AI-powered university learning companion built to help students understand difficult questions through guided reasoning.",
  category: "education"
};

export const viewport: Viewport = {
  themeColor: "#f7f7f4",
  colorScheme: "light"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
