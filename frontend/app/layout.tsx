import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Khata — Lending Ledger",
  description: "Track money lent, interest owed, and collection dates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body min-h-screen">
        <AuthProvider>
          <Nav />
          <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
