import Link from "next/link";
import { Footer, Header } from "@/components/Chrome";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Profile not found</h1>
        <p className="mt-3 text-muted">
          This page doesn&apos;t exist, or the profile isn&apos;t public.
        </p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-white">
          Back to AlgoRecall
        </Link>
      </main>
      <Footer />
    </>
  );
}
