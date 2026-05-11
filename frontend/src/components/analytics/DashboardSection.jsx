export default function DashboardSection({ title, eyebrow, action, children }) {
  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <div>
          {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
