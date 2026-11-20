
import { useCallback, useState } from "react";
import SchemaDrift from "./SchemaDrift";
import CsvUpload from "./CsvUpload";
import DataSageIntro from "./DataSageIntro";
import "./App.css";

const navigation = [
  { label: "Dashboard", icon: "◈" },
  { label: "Upload Data", icon: "⇧" },
  { label: "Data Quality", icon: "◇" },
  { label: "Schema Drift", icon: "⟳" },
  { label: "Tables", icon: "▤" },
  { label: "Relationships", icon: "⌘" },
  { label: "Insights", icon: "✧" },
  { label: "History", icon: "◷" },
  { label: "Settings", icon: "⚙" },
];

function App() {
  const [showIntro, setShowIntro] = useState(() => {
    return (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("datasage-intro-seen") !== "true"
    );
  });

  const finishIntro = useCallback(() => {
    window.sessionStorage.setItem("datasage-intro-seen", "true");
    setShowIntro(false);
  }, []);

  const [activePage, setActivePage] = useState("Dashboard");
  const [search, setSearch] = useState("");

  const goTo = (label: string) => {
    setActivePage(label);

    const target =
      label === "Upload Data"
        ? "upload-section"
        : label === "Dashboard"
          ? "datasage-workspace"
          : label === "Schema Drift"
            ? "schema-drift-page"
            : "quality-dashboard";

    document.getElementById(target)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <>
      {showIntro && <DataSageIntro onComplete={finishIntro} />}

      <div className="datasage-app">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        <aside className="sidebar">
          <button
            className="brand"
            onClick={() => goTo("Dashboard")}
          >
            <span className="brand-mark">✦</span>
            <span>
              <strong>DataSage</strong>
              <small>DATA INTELLIGENCE</small>
            </span>
          </button>

          <p className="sidebar-heading">WORKSPACE</p>

          <nav className="sidebar-nav">
            {navigation.map((item) => (
              <button
                key={item.label}
                className={`nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => goTo(item.label)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>

                {item.label === "Data Quality" && (
                  <span className="nav-count">!</span>
                )}
              </button>
            ))}
          </nav>

          <div className="sidebar-spacer" />

          <div className="sidebar-promo">
            <div className="promo-crystal">✧</div>
            <p className="eyebrow">DATA, REIMAGINED</p>
            <h3>Make your data work smarter.</h3>
            <p className="muted">
              Profile, validate, and discover insights from your data.
            </p>

            <button
              className="promo-button"
              onClick={() => goTo("Upload Data")}
            >
              Explore workspace <span>→</span>
            </button>
          </div>

          <div className="system-status">
            <span className="status-dot" />
            <div>
              <strong>System status</strong>
              <small>API connection available</small>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <label className="global-search">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search tables, columns, issues..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>

            <div className="topbar-actions">
              <span className="workspace-indicator">
                <span className="status-dot" />
                Data workspace
              </span>

              <button
                className="icon-button"
                title="Toggle soft glow"
                onClick={() =>
                  document
                    .querySelector(".datasage-app")
                    ?.classList.toggle("soft-glow")
                }
              >
                ☼
              </button>

              <div className="profile-avatar">DS</div>
            </div>
          </header>

          <section className="hero-section">
            <div className="hero-copy">
              <p className="eyebrow">
                <span className="eyebrow-line" />
                DATA INTELLIGENCE
              </p>

              <h1>
                Quality <span className="gradient-text">Dashboard.</span>
              </h1>

              <p className="hero-description">
                Explore your data quality, uncover hidden patterns, and turn
                raw information into meaningful insights.
              </p>

              <div className="hero-tags">
                <span>✦ Automated profiling</span>
                <span>◇ Quality analysis</span>
                <span>⌘ Relationship discovery</span>
              </div>
            </div>

            <div
              className="hero-visual"
              aria-label="Abstract data crystal"
            >
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <div className="hero-crystal">✧</div>

              <div className="hero-float hero-float-one">
                <span>▥</span>
                <div>
                  <strong>Better data</strong>
                  <small>Higher quality</small>
                </div>
              </div>

              <div className="hero-float hero-float-two">
                <span>⌁</span>
                <div>
                  <strong>Smarter decisions</strong>
                  <small>Powered by insights</small>
                </div>
              </div>
            </div>
          </section>

          <section
            className="workspace-heading"
            id="datasage-workspace"
          >
            <div>
              <p className="section-kicker">YOUR WORKSPACE</p>
              <h2>Data overview</h2>
              <p className="muted">
                Upload a dataset to explore its quality and structure.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => goTo("Upload Data")}
            >
              <span>＋</span> Add dataset
            </button>
          </section>

          <section className="workspace-content">
            <CsvUpload searchQuery={search} />
          </section>

          <SchemaDrift />

          <footer className="app-footer">
            <span>
              <span className="footer-dot" /> DataSage / Data Intelligence
            </span>
            <span>Discover more in your data.</span>
          </footer>
        </main>
      </div>
    </>
  );
}

export default App;
