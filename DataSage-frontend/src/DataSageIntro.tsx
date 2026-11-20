
import { useEffect } from "react";
import "./DataSageIntro.css";

type DataSageIntroProps = {
  onComplete: () => void;
};

const particles = Array.from({ length: 32 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 53 + 7) % 100}%`,
  delay: `${(index % 12) * -0.35}s`,
  duration: `${3 + (index % 5)}s`,
}));

export default function DataSageIntro({
  onComplete,
}: DataSageIntroProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 5200);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <section className="ds-intro" aria-label="Welcome to DataSage">
      <div className="ds-intro-grid" />
      <div className="ds-intro-glow ds-intro-glow-one" />
      <div className="ds-intro-glow ds-intro-glow-two" />

      <div className="ds-intro-particles" aria-hidden="true">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="ds-particle"
            style={{
              left: particle.left,
              top: particle.top,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>

      <button
        className="ds-intro-skip"
        onClick={onComplete}
        type="button"
      >
        Skip intro <span aria-hidden="true">↗</span>
      </button>

      <div className="ds-intro-content">
        <div className="ds-intro-emblem">
          <div className="ds-emblem-orbit ds-emblem-orbit-one" />
          <div className="ds-emblem-orbit ds-emblem-orbit-two" />
          <div className="ds-emblem-core">
            <span>✦</span>
          </div>
          <span className="ds-emblem-node node-one" />
          <span className="ds-emblem-node node-two" />
          <span className="ds-emblem-node node-three" />
          <span className="ds-emblem-node node-four" />
        </div>

        <p className="ds-intro-overline">
          INTELLIGENCE IN EVERY DATA POINT
        </p>

        <h1 className="ds-intro-title">
          Data<span>Sage</span>
        </h1>

        <p className="ds-intro-tagline">
          Turn raw data into
          <span> reliable intelligence.</span>
        </p>

        <div className="ds-intro-status">
          <span className="ds-intro-status-dot" />
          <span>INITIALIZING DATA INTELLIGENCE</span>
        </div>

        <div className="ds-intro-progress">
          <span />
        </div>
      </div>

      <div className="ds-intro-footer">
        <span>DATA QUALITY</span>
        <span className="ds-footer-separator">✦</span>
        <span>SCHEMA INTELLIGENCE</span>
        <span className="ds-footer-separator">✦</span>
        <span>SMARTER DECISIONS</span>
      </div>
    </section>
  );
}
