import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ziza Photography" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ziza Photography",
    description:
      "Encontre e baixe suas fotos por evento. Busca por selfie e entrega digital rápida.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
