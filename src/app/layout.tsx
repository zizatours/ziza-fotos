import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "react-day-picker/style.css";
import Header from '@/components/Header'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://zizaphotography.com.br"),
  title: {
    default: "Ziza Photography",
    template: "%s | Ziza Photography",
  },
  description:
    "Encontre e baixe suas fotos por evento. Busca por selfie e entrega digital rápida.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Ziza Photography",
    description:
      "Encontre e baixe suas fotos por evento. Busca por selfie e entrega digital rápida.",
    url: "/",
    siteName: "Ziza Photography",
    locale: "pt_BR",
    type: "website",
    // Se depois você subir uma imagem OG em /public/og.jpg, descomente:
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Ziza Photography" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ziza Photography",
    description:
      "Encontre e baixe suas fotos por evento. Busca por selfie e entrega digital rápida.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <meta
          name="ziza-build"
          content={process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "local"}
        />
      </head>
      <body>
        <Header />

        {/* DEBUG: stamp de versión (para saber si te están sirviendo HTML viejo) */}
        <div
          id="ziza-build-stamp"
          data-deploy={process.env.VERCEL_DEPLOYMENT_ID || "no-vercel-deploy-id"}
          data-commit={process.env.VERCEL_GIT_COMMIT_SHA || "no-commit-sha"}
          style={{ position: "fixed", bottom: 8, right: 8, fontSize: 10, opacity: 0.35, zIndex: 9999 }}
        >
          {(process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "local").slice(0, 8)}
        </div>

        {children}
      </body>
    </html>
  );
}
