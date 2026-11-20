
import { useEffect, useMemo, useState } from "react";

type Props = {
  projectId: string;
  versionId: string;
  searchQuery?: string;
};

type RecordData = Record<string, unknown>;

type Counts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  other: number;
};

type DashboardData = {
  quality: RecordData | null;
  issues: RecordData[];
  tables: RecordData[];
  relationships: RecordData[];
};

const zeroCounts: Counts = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  other: 0,
};

const severityColors = [
  "#ff438e",
  "#ff805d",
  "#ffc94f",
  "#35d9e3",
  "#6e91ff",
];

function record(value: unknown): RecordData {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RecordData)
    : {};
}

function unwrap(value: unknown): RecordData {
  const root = record(value);
  const data = record(root.data);
  const result = record(root.result);
  return Object.keys(data).length ? data : Object.keys(result).length ? result : root;
}

function arrayFrom(value: unknown, keys: string[]): RecordData[] {
  if (Array.isArray(value)) return value.map(record);
  const obj = record(value);
  for (const key of keys) {
    if (Array.isArray(obj[key])) return (obj[key] as unknown[]).map(record);
  }
  return [];
}

function text(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function number(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return 0;
}



function getScore(quality: RecordData | null, key: string): number {
  if (!quality) return 0;

  const score = record(quality.score);
  const candidates = [
    score[key],
    quality[key],
  ];

  for (const candidate of candidates) {
    if (
      (typeof candidate === "number" || typeof candidate === "string") &&
      String(candidate).trim() !== "" &&
      Number.isFinite(Number(candidate))
    ) {
      return Number(candidate);
    }
  }

  return 0;
}






function overallScore(quality: RecordData | null): number {
  if (!quality) return 0;

  const score = record(quality.score);
  const nested = record(quality.data);
  const metrics = record(quality.metrics);
  const scores = record(quality.scores);

  const candidates = [
    score.overallScore,
    score.overall_score,
    score.overall,
    score.score,
    quality.overallScore,
    quality.overall_score,
    quality.overall,
    quality.score,
    metrics.overallScore,
    metrics.overall_score,
    scores.overallScore,
    scores.overall_score,
    nested.overallScore,
    nested.overall_score,
  ];

  for (const candidate of candidates) {
    if (
      (typeof candidate === "number" || typeof candidate === "string") &&
      String(candidate).trim() !== "" &&
      Number.isFinite(Number(candidate))
    ) {
      return Number(candidate);
    }
  }

  return 0;
}



function severity(issue: RecordData): string {
  return text(issue.severity ?? issue.level ?? issue.priority, "Other");
}

function severityKey(value: string): keyof Counts {
  const v = value.toLowerCase();
  if (v.includes("critical")) return "critical";
  if (v.includes("high")) return "high";
  if (v.includes("medium")) return "medium";
  if (v.includes("low")) return "low";
  return "other";
}

function issueTitle(issue: RecordData): string {
  return text(
    issue.title ??
      issue.message ??
      issue.description ??
      issue.issueType ??
      issue.issue_type ??
      issue.type,
    "Data quality issue",
  );
}

function issueLocation(issue: RecordData): string {
  const table = text(issue.tableName ?? issue.table_name ?? issue.table, "");
  const column = text(issue.columnName ?? issue.column_name ?? issue.column, "");
  return table && column ? `${table}.${column}` : table || column || "Dataset";
}

function tableName(table: RecordData): string {
  return text(table.tableName ?? table.table_name ?? table.name, "Unnamed table");
}

function rowCount(table: RecordData): number {
  return number(table.rowCount ?? table.row_count ?? table.rows);
}

function columnCount(table: RecordData): number {
  const cols = table.columnCount ?? table.column_count ?? table.columns;
  return Array.isArray(cols) ? cols.length : number(cols);
}

function matchesSearch(values: unknown[], query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return values.some((v) => String(v ?? "").toLowerCase().includes(q));
}

function Metric({
  label,
  value,
  detail,
  icon,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
  color: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${color}`}>{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  );
}

function Dimension({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="dimension-heading">
        <span>{label}</span>
        <strong>{safe.toFixed(1)}%</strong>
      </div>
      <div className="dimension-track">
        <div className={`dimension-fill ${color}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function DonutChart({
  values,
  labels,
  colors,
  centerValue,
  centerLabel,
}: {
  values: number[];
  labels: string[];
  colors: string[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = values.reduce((sum, v) => sum + v, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="chart-layout">
      <svg
        className="chart-svg"
        viewBox="0 0 120 120"
        role="img"
        aria-label={`${centerValue} ${centerLabel}`}
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="rgba(150,160,220,.13)"
          strokeWidth="13"
        />
        {values.map((value, i) => {
          const length = total > 0 ? (value / total) * circumference : 0;
          const circle = (
            <circle
              key={labels[i]}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={colors[i]}
              strokeWidth="13"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += length;
          return circle;
        })}
        <text
          x="60"
          y="57"
          textAnchor="middle"
          fill="#f7f5ff"
          fontSize="17"
          fontWeight="800"
        >
          {centerValue}
        </text>
        <text
          x="60"
          y="70"
          textAnchor="middle"
          fill="#aeb7df"
          fontSize="7"
        >
          {centerLabel}
        </text>
      </svg>

      <div className="chart-legend">
        {labels.map((label, i) => (
          <div className="legend-row" key={label}>
            <span className="legend-dot" style={{ background: colors[i] }} />
            <span>{label}</span>
            <strong>{values[i]}</strong>
          </div>
        ))}
        {total === 0 && <p className="muted">No issues reported.</p>}
      </div>
    </div>
  );
}

function IssueTypeChart({ issues }: { issues: RecordData[] }) {
  const types = useMemo(() => {
    const map = new Map<string, number>();

    for (const issue of issues) {
      const label = text(
        issue.issueType ?? issue.issue_type ?? issue.type ?? issue.category,
        "Other",
      );
      map.set(label, (map.get(label) ?? 0) + 1);
    }

    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [issues]);

  if (!types.length) {
    return <div className="chart-empty">Issue-type data will appear after analysis.</div>;
  }

  const max = Math.max(...types.map((item) => item[1]), 1);
  const chartHeight = 145;
  const chartWidth = 340;
  const left = 24;
  const bottom = 105;
  const barWidth = Math.min(35, (chartWidth - left - 10) / types.length - 12);
  const gap = (chartWidth - left - types.length * barWidth - 10) / types.length;

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      role="img"
      aria-label="Issues by type bar chart"
    >
      {[0, 0.5, 1].map((fraction) => {
        const y = bottom - fraction * 76;
        return (
          <line
            key={fraction}
            x1={left}
            y1={y}
            x2={chartWidth - 5}
            y2={y}
            className="chart-axis"
          />
        );
      })}
      {types.map(([label, value], i) => {
        const x = left + gap / 2 + i * (barWidth + gap);
        const height = (value / max) * 76;
        const shortLabel = label.length > 11 ? `${label.slice(0, 10)}…` : label;
        return (
          <g key={label}>
            <rect
              x={x}
              y={bottom - height}
              width={barWidth}
              height={height}
              rx="5"
              fill={["#4388ff", "#a36aff", "#f15caa", "#ff9b59", "#32d2df"][i]}
              opacity=".95"
            />
            <text
              x={x + barWidth / 2}
              y={bottom - height - 7}
              textAnchor="middle"
              className="chart-value"
            >
              {value}
            </text>
            <text
              x={x + barWidth / 2}
              y={bottom + 17}
              textAnchor="middle"
              className="chart-label"
            >
              {shortLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function QualityDashboard({ projectId, versionId, searchQuery = "" }: Props) {
  const [data, setData] = useState<DashboardData>({
    quality: null,
    issues: [],
    tables: [],
    relationships: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState("Issues");

  useEffect(() => {
    if (!projectId || !versionId) {
      setData({ quality: null, issues: [], tables: [], relationships: [] });
      return;
    }

    const controller = new AbortController();
    const base = `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const urls = [
          `${base}/quality-score`,
          `${base}/issues?page=1&pageSize=100`,
          `${base}/tables`,
          `${base}/relationships`,
        ];

        const responses = await Promise.all(
          urls.map((url) => fetch(url, { signal: controller.signal })),
        );

        const bad = responses.find((response) => !response.ok);
        if (bad) throw new Error(`API request failed: ${bad.status}`);

        const json = await Promise.all(responses.map((r) => r.json() as Promise<unknown>));
        if (controller.signal.aborted) return;

        const qualityPayload = unwrap(json[0]);
        const issuesPayload = unwrap(json[1]);
        const tablesPayload = unwrap(json[2]);
        const relationshipsPayload = unwrap(json[3]);

        setData({
          quality: record(qualityPayload.quality ?? qualityPayload),
          issues: arrayFrom(issuesPayload, ["items", "results", "issues", "data"]),
          tables: arrayFrom(tablesPayload, ["items", "results", "tables", "data"]),
          relationships: arrayFrom(relationshipsPayload, [
            "items",
            "results",
            "relationships",
            "data",
          ]),
        });
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? `${err.message}. Check that the backend is running on port 8000.`
              : "Could not load dashboard data.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [projectId, versionId, refresh]);

  const filteredIssues = useMemo(
    () =>
      data.issues.filter((issue) =>
        matchesSearch(
          [
            issueTitle(issue),
            issueLocation(issue),
            severity(issue),
            issue.type,
            issue.category,
          ],
          searchQuery,
        ),
      ),
    [data.issues, searchQuery],
  );

  const filteredTables = useMemo(
    () =>
      data.tables.filter((table) =>
        matchesSearch([tableName(table), table.description], searchQuery),
      ),
    [data.tables, searchQuery],
  );

  const filteredRelationships = useMemo(
    () =>
      data.relationships.filter((item) =>
        matchesSearch(
          [
            item.source,
            item.sourceTable,
            item.source_table,
            item.sourceColumn,
            item.target,
            item.targetTable,
            item.target_table,
            item.targetColumn,
            item.type,
          ],
          searchQuery,
        ),
      ),
    [data.relationships, searchQuery],
  );

  const counts = useMemo(() => {
    const next: Counts = { ...zeroCounts };
    for (const issue of filteredIssues) next[severityKey(severity(issue))] += 1;
    return next;
  }, [filteredIssues]);

  const totalIssues = Object.values(counts).reduce(
    (sum: number, value: number) => sum + value,
    0,
  );
  const score = overallScore(data.quality);
  const totalRows = filteredTables.reduce((sum, table) => sum + rowCount(table), 0);
  const totalColumns = filteredTables.reduce(
    (sum, table) => sum + columnCount(table),
    0,
  );

  if (!projectId || !versionId) {
    return (
      <section className="dashboard-panel" id="quality-dashboard">
        <div className="empty-state">
          <span className="empty-state-icon">◇</span>
          <h3>Ready to analyze your data</h3>
          <p>Upload a CSV to see its quality score, issue charts, and structure.</p>
        </div>
      </section>
    );
  }

  const tabs = ["Issues", "Tables", "Relationships", "Insights"];

  return (
    <section className="quality-dashboard" id="quality-dashboard">
      <div className="dashboard-title-row">
        <div>
          <p className="section-kicker">DATA INTELLIGENCE</p>
          <h2>Analytics overview</h2>
          <p className="dashboard-subtitle">
            Your data quality, summarized in clear, actionable visuals.
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => setRefresh((n) => n + 1)}
          disabled={loading}
        >
          ↻ {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          <strong>Dashboard could not load</strong>
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="dashboard-loading" role="status">
          <span className="loading-orb" /> Loading your dataset analytics...
        </div>
      )}

      <div className="dashboard-metrics">
        <Metric
          label="Overall quality"
          value={data.quality ? `${score.toFixed(1)}%` : "—"}
          detail="Combined quality score"
          icon="✓"
          color="metric-violet"
        />
        <Metric
          label="Total tables"
          value={String(filteredTables.length)}
          detail="Tables discovered"
          icon="▦"
          color="metric-cyan"
        />
        <Metric
          label="Rows analyzed"
          value={totalRows.toLocaleString()}
          detail={`${totalColumns.toLocaleString()} columns`}
          icon="⌁"
          color="metric-pink"
        />
        <Metric
          label="Quality issues"
          value={String(totalIssues)}
          detail="In the loaded issue list"
          icon="◇"
          color="metric-orange"
        />
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h3>Quality score breakdown</h3>
              <p>Performance across key dimensions</p>
            </div>
            <span className="panel-heading-icon">◉</span>
          </div>

          <div className="chart-layout">
            <svg className="chart-svg" viewBox="0 0 120 120" role="img" aria-label="Overall quality score">
              <defs>
                <linearGradient id="qualityGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#39d5f2" />
                  <stop offset="100%" stopColor="#a36aff" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(150,160,220,.13)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke="url(#qualityGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0, Math.min(100, score)) * 2.6389} 263.89`}
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="58" textAnchor="middle" fill="#f7f5ff" fontSize="16" fontWeight="800">
                {data.quality ? `${score.toFixed(1)}%` : "—"}
              </text>
              <text x="60" y="71" textAnchor="middle" fill="#aeb7df" fontSize="7">QUALITY</text>
            </svg>

            <div className="quality-dimensions">
              <Dimension label="Completeness" value={getScore(data.quality, "completeness")} color="dimension-purple" />
              <Dimension label="Uniqueness" value={getScore(data.quality, "uniqueness")} color="dimension-cyan" />
              <Dimension label="Validity" value={getScore(data.quality, "validity")} color="dimension-pink" />
              <Dimension label="Consistency" value={getScore(data.quality, "consistency")} color="dimension-blue" />
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h3>Issue severity distribution</h3>
              <p>How the loaded issues are categorized</p>
            </div>
            <span className="panel-heading-icon">◉</span>
          </div>
          <DonutChart
            values={[counts.critical, counts.high, counts.medium, counts.low, counts.other]}
            labels={["Critical", "High", "Medium", "Low", "Other"]}
            colors={severityColors}
            centerValue={String(totalIssues)}
            centerLabel="ISSUES"
          />
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h3>Issues by type</h3>
              <p>Most frequent issue categories</p>
            </div>
            <span className="panel-heading-icon">▥</span>
          </div>
          <IssueTypeChart issues={filteredIssues} />
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h3>Dataset structure</h3>
              <p>Discovered tables and columns</p>
            </div>
          </div>
          <div className="structure-stats">
            <div className="structure-stat">
              <span className="structure-stat-icon">▤</span>
              <div><strong>{filteredTables.length}</strong><span>Tables</span></div>
            </div>
            <div className="structure-stat">
              <span className="structure-stat-icon">▥</span>
              <div><strong>{totalColumns.toLocaleString()}</strong><span>Columns</span></div>
            </div>
            <div className="structure-stat">
              <span className="structure-stat-icon">⌘</span>
              <div><strong>{filteredRelationships.length}</strong><span>Relationships</span></div>
            </div>
          </div>
          <div className="table-preview-list">
            {filteredTables.slice(0, 4).map((table, i) => (
              <div className="table-preview-row" key={String(table.id ?? tableName(table) + i)}>
                <span className="table-preview-icon">▤</span>
                <span className="table-preview-name">{tableName(table)}</span>
                <span className="table-preview-count">{rowCount(table).toLocaleString()} rows</span>
              </div>
            ))}
            {filteredTables.length === 0 && (
              <p className="muted">No table records returned by the API.</p>
            )}
          </div>
        </article>
      </div>

      <div className="dashboard-tabs" role="tablist" aria-label="Dataset details">
        {tabs.map((name) => (
          <button
            key={name}
            className={`dashboard-tab ${tab === name ? "active" : ""}`}
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
            {name === "Issues" && <span className="tab-count">{filteredIssues.length}</span>}
            {name === "Tables" && <span className="tab-count">{filteredTables.length}</span>}
          </button>
        ))}
      </div>

      <article className="dashboard-panel full-width-panel">
        <div className="panel-heading">
          <div>
            <h3>{tab === "Insights" ? "Quality insights" : `Dataset ${tab.toLowerCase()}`}</h3>
            <p>Search results update with the global search field above.</p>
          </div>
        </div>

        {tab === "Issues" && (
          filteredIssues.length ? (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Issue</th><th>Location</th><th>Type</th><th>Severity</th></tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue, i) => (
                    <tr key={String(issue.id ?? issue.issueId ?? issueTitle(issue) + i)}>
                      <td>{issueTitle(issue)}</td>
                      <td>{issueLocation(issue)}</td>
                      <td>{text(issue.issueType ?? issue.issue_type ?? issue.type)}</td>
                      <td><span className={`issue-severity-badge severity-${severityKey(severity(issue))}`}>{severity(issue)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-state"><span className="empty-state-icon">✓</span><h3>No matching issues</h3><p>No issues match your search or the API returned none.</p></div>
        )}

        {tab === "Tables" && (
          filteredTables.length ? (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead><tr><th>Table name</th><th>Rows</th><th>Columns</th></tr></thead>
                <tbody>
                  {filteredTables.map((table, i) => (
                    <tr key={String(table.id ?? tableName(table) + i)}>
                      <td>{tableName(table)}</td>
                      <td>{rowCount(table).toLocaleString()}</td>
                      <td>{columnCount(table).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-state"><h3>No table records</h3><p>The API did not return any table records.</p></div>
        )}

        {tab === "Relationships" && (
          filteredRelationships.length ? (
            <div className="relationship-list">
              {filteredRelationships.map((item, i) => (
                <div className="relationship-card" key={String(item.id ?? i)}>
                  <div className="relationship-endpoint">
                    <span className="relationship-endpoint-icon">▤</span>
                    <div>
                      <strong>{text(item.source ?? item.sourceTable ?? item.source_table, "Source")}</strong>
                      <span>{text(item.sourceColumn ?? item.source_column, "")}</span>
                    </div>
                  </div>
                  <div className="relationship-connector">→<small>{text(item.type, "Related")}</small></div>
                  <div className="relationship-endpoint">
                    <span className="relationship-endpoint-icon">▤</span>
                    <div>
                      <strong>{text(item.target ?? item.targetTable ?? item.target_table, "Target")}</strong>
                      <span>{text(item.targetColumn ?? item.target_column, "")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><span className="empty-state-icon">⌘</span><h3>No relationships discovered</h3><p>No relationships were returned by the API for this dataset.</p></div>
        )}

        {tab === "Insights" && (
          <div className="insight-list">
            <p>Overall quality score: <strong>{data.quality ? `${score.toFixed(1)}%` : "Not available"}</strong></p>
            <p>Loaded issues: <strong>{totalIssues}</strong></p>
            <p>Tables discovered: <strong>{filteredTables.length}</strong></p>
            <p>Relationships discovered: <strong>{filteredRelationships.length}</strong></p>
            <p className="muted">These summaries reflect the data returned by the backend. No extra findings are fabricated.</p>
          </div>
        )}
      </article>
    </section>
  );
}

export default QualityDashboard;
