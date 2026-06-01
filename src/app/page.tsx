// Landing page — placeholder for EPIC-1. Full hero/how-it-works/FAQ in EPIC-5 (Day 9).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">TaxSnap</h1>
      <p className="text-lg text-gray-600">
        Your bank knows <span className="font-medium">what</span> you spent — but not{' '}
        <span className="font-medium">why</span>. TaxSnap captures both.
      </p>
      <p className="text-sm text-gray-400">V1 build in progress · EPIC-1 Foundation</p>
    </main>
  );
}
