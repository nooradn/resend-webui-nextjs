import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resend Email Client",
};

const themeInitScript = `try {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.dataset.theme = saved;
} catch (e) {}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
