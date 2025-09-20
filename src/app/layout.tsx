import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortfolioProvider } from "@/contexts/PortfolioContext";
import { TimeRangeProvider } from "@/contexts/TimeRangeContext";

export const metadata: Metadata = {
  title: "Good Theta",
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
            <TimeRangeProvider>
              {children}
            </TimeRangeProvider>
          </PortfolioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
