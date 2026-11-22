import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TracePilot | AI Agent Debugger",
  description: "A lightweight prototype for investigating simulated AI-agent failures."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
