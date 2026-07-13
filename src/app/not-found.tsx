import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-200">Page not found</h1>
        <p className="text-slate-400">The page you are looking for does not exist or has been moved.</p>
        <Link href="/" className="inline-block mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Go to home</Link>
      </div>
    </main>
  );
}
