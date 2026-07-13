"use client";

export default function LegalKitError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-red-400">Legal Kit error</h1>
        <p className="text-slate-300">{error.message || "Failed to load the Legal Action Kit."}</p>
        {error.digest && <p className="text-xs text-slate-500">Error ID: {error.digest}</p>}
        <button onClick={reset} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Try again</button>
      </div>
    </main>
  );
}
