import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortfolioProvider } from "@/contexts/PortfolioContext";

export const metadata: Metadata = {
  title: "Options Tracker",
  description: "Track your options positions and performance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <PortfolioProvider>
            {children}
          </PortfolioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
