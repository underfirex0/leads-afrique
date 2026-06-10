import "./globals.css";

export const metadata = {
  title: "Africa Leads — Manufacturer Database",
  description: "Discover and enrich paint & cement-glue manufacturers across Africa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
