import Link from "next/link";
import { CTAButton, Footer, Header } from "@/components/Chrome";

const steps = [
  ["Solve", "Solve a problem on LeetCode or NeetCode like you always do."],
  ["Capture", "AlgoRecall notices the accepted submission and saves it with its pattern."],
  ["Review", "Each day, review exactly what is due. Rate how it felt; the schedule adapts."],
];

const features = [
  ["Auto-capture", "Accepted submissions are saved automatically with title, difficulty and pattern tags."],
  ["SM-2 scheduling", "The proven spaced repetition algorithm decides when each problem returns."],
  ["Streaks & heatmap", "Keep a daily streak alive and see a year of practice at a glance."],
  ["Focus mode", "Drill your weakest patterns first, where retention is lowest."],
  ["Mock interviews", "Timed sessions weighted toward weak and overdue problems."],
  ["Cloud sync", "Sign in once and your progress follows you across devices."],
];

export default function Home() {
  return (
    <>
      <div className="glow">
        <Header />
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-12 text-center sm:pt-20">
          <p className="mx-auto mb-5 w-fit rounded-full border border-line bg-card px-3 py-1 font-mono text-xs text-muted">
            Spaced repetition for LeetCode &amp; NeetCode
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Never forget a <span className="text-accent">DSA pattern</span> again
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            You already solved it once. AlgoRecall brings it back right before you would forget,
            so two pointers, DP and graph patterns are there when the interview starts.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CTAButton />
            <Link
              href="/u/demo"
              className="rounded-xl border border-line px-5 py-3 text-base font-medium hover:border-accent"
            >
              See a public profile
            </Link>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-line bg-card p-5">
              <span className="font-mono text-sm text-accent">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Everything you need to retain</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([t, d]) => (
            <li key={t} className="rounded-2xl border border-line bg-card p-5 transition hover:border-accent">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="glow rounded-3xl border border-line bg-card px-6 py-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Start remembering what you solve</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">Free Chrome extension. Your data stays local unless you sign in to sync.</p>
          <div className="mt-6">
            <CTAButton />
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
