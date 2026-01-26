import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "react-day-picker/style.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ✅ WHATSAPP (global)
const whatsappNumber = "5521970864545";
const whatsappHref = `https://wa.me/${whatsappNumber}`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://zizaphotography.com.br"),
  title: {
    default: "Ziza Photography",
    template: "%s | Ziza Photography",
  },
  description: "Encontre e baixe suas fotos por evento. Busca por selfie e entrega digital rápida.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Ziza Photography",
    description: "Encontre e baixe suas fotos por evento. Busca por selfie e entrega digital rápida.",
    url: "/",
    siteName: "Ziza Photography",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Ziza Photography" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ziza Photography",
    description: "Encontre e baixe suas fotos por evento. Busca por selfie e entrega digital rápida.",
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

      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {/* ✅ BOTÃO WHATSAPP (ícone clássico) */}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
          className="fixed bottom-5 right-5 z-[9999] h-14 w-14 rounded-full shadow-lg hover:opacity-95 active:scale-95 transition"
        >
          <img
            src="/whatsapp.png"
            alt="WhatsApp"
            className="h-full w-full rounded-full"
          />
        </a>

        {children}
      </body>
    </html>
  );
}
