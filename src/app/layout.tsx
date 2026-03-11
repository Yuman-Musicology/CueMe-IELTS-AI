"use client";

import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/about-u" || pathname === "/";

  return (
    <html lang="en">
      <body className="bg-[#F5F2ED] antialiased">
        {!isAuthPage && <Sidebar />}
        <main
          className={[
            "min-h-screen flex-1 bg-[#F5F2ED]",
            isAuthPage ? "" : "pl-32",
          ].join(" ")}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
