import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import Navbar from './components/Navbar';
import { AuthProvider } from './context/AuthContext';

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Odds Craft",
  description: "Opinion Trading App",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <AuthProvider>
        <body className={`${inter.className} overflow-x-hidden`}>
          <Navbar />
          <main className="min-h-screen flex flex-col">{children}</main>
        </body>
      </AuthProvider>
    </html>
  )
}
