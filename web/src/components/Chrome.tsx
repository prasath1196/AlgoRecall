import Link from "next/link";
import { CHROME_STORE_URL, GITHUB_URL } from "@/lib/site";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-lg bg-accent font-mono text-sm text-white"
      >
        ↻
      </span>
      AlgoRecall
    </Link>
  );
}

export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
      <Logo />
      <a
        href={CHROME_STORE_URL}
        className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium hover:border-accent"
      >
        Add to Chrome
      </a>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} AlgoRecall. Built for people who grind.</span>
        <a href={GITHUB_URL} className="hover:text-foreground" rel="noopener noreferrer">
          GitHub · prasath1196/AlgoRecall
        </a>
      </div>
    </footer>
  );
}

export function CTAButton({ children = "Add to Chrome" }: { children?: React.ReactNode }) {
  return (
    <a
      href={CHROME_STORE_URL}
      className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-base font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110"
    >
      {children}
    </a>
  );
}
