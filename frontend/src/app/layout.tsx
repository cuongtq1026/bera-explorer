import "./globals.css";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
dayjs.extend(relativeTime);

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const headers = [
  {
    title: "Home",
    href: "/",
  },
  {
    title: "Blocks",
    href: "/blocks",
  },
];

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased container mx-auto grid gap-6`}
      >
        <title>Bera Explorer</title>
        <h1 className={"text-3xl font-bold text-center mt-4"}>
          <Link href={"/"} className={"px-4 py-2"}>
            Bera Explorer
          </Link>
        </h1>
        <ul className={"bg-gray-200 text-xl font-semibold flex p-2"}>
          {headers.map(({ title, href }) => (
            <li key={title}>
              <Link className={"hover:underline p-3"} href={href}>
                {title}
              </Link>
            </li>
          ))}
        </ul>
        {children}
      </body>
    </html>
  );
}
