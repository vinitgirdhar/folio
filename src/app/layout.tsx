import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Folio — Trade desk",
  description:
    "A clear view of your trades. BSE mock trade dashboard with resilient background imports.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{let t=localStorage.getItem('folio-theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
