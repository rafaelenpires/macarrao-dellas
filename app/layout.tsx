import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Macarrão Dellas | Delivery",
  description: "Cardápio e pedidos do Macarrão Dellas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
