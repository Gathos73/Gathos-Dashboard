export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="loading-page">
      <div className="loading-sidebar" />
      <div className="loading-workspace">
        <div className="loading-topbar" />
        <div className="loading-content">
          <div className="skeleton skeleton-eyebrow" />
          <div className="skeleton skeleton-heading" />
          <div className="skeleton skeleton-subheading" />
          <div className="loading-card-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="skeleton skeleton-card" key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
