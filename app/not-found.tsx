import Link from "next/link";

export default function NotFound() {
  return (
    <main className="standalone-state">
      <span className="brand-mark brand-mark--large">G</span>
      <p className="eyebrow">404 · Not found</p>
      <h1>This page wandered off.</h1>
      <p>The dashboard page you requested does not exist.</p>
      <Link className="button button-primary" href="/">
        Back to analytics
      </Link>
    </main>
  );
}
