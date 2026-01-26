import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanban | Guilherme & Safira",
  description: "Quadro Kanban para gestão de tarefas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
