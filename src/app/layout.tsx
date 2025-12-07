import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { AuthProvider } from "../contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pretendard = localFont({
  src: [
    {
      path: "../fonts/Pretendard-Thin.ttf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-ExtraLight.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Black.ttf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MAKER3D",
  description: "3D프린팅 전문기업 - 당신의 상상력을 현실로 만드는 MAKER3D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${pretendard.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            <main style={{ flex: 1, paddingTop: '75px', backgroundColor: "white" }}>
              {children}
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
