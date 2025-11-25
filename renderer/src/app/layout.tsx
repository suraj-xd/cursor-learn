import localFont from "next/font/local"
import "./globals.css"
import "../styles/prism-theme.css"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toaster"

const grotesk = localFont({
  src: [
    { path: "../../../resources/fonts/FKGroteskNeue-Thin.otf", weight: "100", style: "normal" },
    { path: "../../../resources/fonts/FKGrotesk-Light.ttf", weight: "300", style: "normal" },
    { path: "../../../resources/fonts/FKGrotesk-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../../resources/fonts/FKGrotesk-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
})

const berkeleyMono = localFont({
  src: [
    { path: "../../../resources/fonts/BerkeleyMono-Regular.otf", weight: "400", style: "normal" },
    { path: "../../../resources/fonts/BerkeleyMono-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
})

const newsreader = localFont({
  src: [
    { path: "../../../resources/fonts/Newsreader_9pt-Light.ttf", weight: "300", style: "normal" },
    { path: "../../../resources/fonts/Newsreader_9pt-Regular.ttf", weight: "400", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${grotesk.variable} ${berkeleyMono.variable} ${newsreader.variable} min-h-screen flex flex-col`}
      >
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <Navbar />
            <main className="flex-1 bg-background">
              {children}
            </main>
            {/* <Footer /> */}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 