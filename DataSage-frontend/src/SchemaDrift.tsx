
import { useState } from "react";

type DriftChange = {
  changeType: string;
  column: string;
  oldValue?: string | number;
  newValue?: string | number;
  addedCategories?: string[];
  removedCategories?: string[];
  distributionChanges?: Array<{
    category: string;
    oldPercentage: number;
    newPercentage: number;
    changePercentagePoints: number;
  }>;
  explanation?: string;
};

type RenameCandidate = {
  oldColumn: string;
  newColumn: string;
  nameSimilarity: number;
  valueOverlap: number;
  confidence: number;
  status: string;
  explanation: string;
};

type RowRecord = Record<string, string | number | boolean | null>;

type RowChange = {
  status: string;
  keyColumn: string | null;
  addedRows: RowRecord[];
  removedRows: RowRecord[];
  modifiedRows: Array<{
    key: string;
    changes: Record<
      string,
      { oldValue: string | null; newValue: string | null }
    >;
  }>;
  note: string;
};

type DriftReport = {
  status: string;
  oldVersion: { rowCount: number; columnCount: number };
  newVersion: { rowCount: number; columnCount: number };
  addedColumns: string[];
  removedColumns: string[];
  commonColumns: string[];
  changes: DriftChange[];
  possibleRenames: RenameCandidate[];
  limitations: string[];
  rowChanges: RowChange;
};

type CsvFile = File | null;

function SchemaDrift() {
  const [oldFile, setOldFile] = useState<CsvFile>(null);
  const [newFile, setNewFile] = useState<CsvFile>(null);
  const [report, setReport] = useState<DriftReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const compareVersions = async () => {
    if (!oldFile || !newFile) {
      setError("Please select both the old and new CSV files.");
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);

    try {
      const [oldCsvContent, newCsvContent] = await Promise.all([
        oldFile.text(),
        newFile.text(),
      ]);

      const response = await fetch(
       "/schema-drift/internal/schema-drift/compare",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldCsvContent, newCsvContent }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const detail =
          typeof result.detail === "string"
            ? result.detail
            : "The comparison request failed.";
        throw new Error(detail);
      }

      setReport(result as DriftReport);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to compare these files."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetComparison = () => {
    setOldFile(null);
    setNewFile(null);
    setReport(null);
    setError("");
  };

  const changeTitle = (type: string) => {
    const titles: Record<string, string> = {
      type_changed: "Data type changed",
      value_pattern_changed: "Value pattern changed",
      null_percentage_changed: "Empty values changed",
      categorical_values_changed: "Categories changed",
    };
    return titles[type] ?? type.replaceAll("_", " ");
  };

  return (
    <section className="drift-page" id="schema-drift-page">
      <div className="drift-heading">
        <p className="section-kicker">SCHEMA INTELLIGENCE</p>
        <h2>Schema Drift Analysis</h2>
        <p className="muted">
          Compare dataset versions to discover structural changes and
          potential changes in the data.
        </p>
      </div>

      <div className="drift-upload-grid">
        <label className="drift-file-card">
          <span className="drift-file-icon">↥</span>
          <strong>Old dataset</strong>
          <span className="muted">Choose the previous CSV version</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              setOldFile(event.target.files?.[0] ?? null)
            }
          />
          <span className="drift-file-name">
            {oldFile ? oldFile.name : "No file selected"}
          </span>
        </label>

        <label className="drift-file-card">
          <span className="drift-file-icon">↥</span>
          <strong>New dataset</strong>
          <span className="muted">Choose the latest CSV version</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              setNewFile(event.target.files?.[0] ?? null)
            }
          />
          <span className="drift-file-name">
            {newFile ? newFile.name : "No file selected"}
          </span>
        </label>
      </div>

      <div className="drift-actions">
        <button
          className="primary-button"
          onClick={compareVersions}
          disabled={loading}
        >
          {loading ? "Comparing versions..." : "Compare versions →"}
        </button>
        <button className="drift-reset-button" onClick={resetComparison}>
          Reset
        </button>
      </div>

      {error && <div className="drift-error">{error}</div>}

      {report && (
        <div className="drift-results">
          <div className="drift-result-heading">
            <div>
              <p className="section-kicker">COMPARISON REPORT</p>
              <h3>What changed?</h3>
            </div>
            <span className="drift-success">Comparison complete</span>
          </div>

          <div className="drift-stats">
            <div className="drift-stat">
              <span>Old rows</span>
              <strong>{report.oldVersion.rowCount.toLocaleString()}</strong>
              <small>{report.oldVersion.columnCount} columns</small>
            </div>
            <div className="drift-stat">
              <span>New rows</span>
              <strong>{report.newVersion.rowCount.toLocaleString()}</strong>
              <small>{report.newVersion.columnCount} columns</small>
            </div>
            <div className="drift-stat">
              <span>Added columns</span>
              <strong>{report.addedColumns.length}</strong>
              <small>New fields</small>
            </div>
            <div className="drift-stat">
              <span>Detected changes</span>
              <strong>{report.changes.length}</strong>
              <small>Column-level signals</small>
            </div>
          </div>

          <div className="drift-result-card">
            <h3>Structural changes</h3>
            <div className="drift-column-lists">
              <div>
                <h4>Added columns</h4>
                {report.addedColumns.length ? (
                  report.addedColumns.map((column) => (
                    <span className="drift-chip added" key={column}>
                      + {column}
                    </span>
                  ))
                ) : (
                  <p className="muted">No added columns</p>
                )}
              </div>
              <div>
                <h4>Removed columns</h4>
                {report.removedColumns.length ? (
                  report.removedColumns.map((column) => (
                    <span className="drift-chip removed" key={column}>
                      − {column}
                    </span>
                  ))
                ) : (
                  <p className="muted">No removed columns</p>
                )}
              </div>
            </div>
          </div>

          <div className="drift-result-card">
            <h3>Possible column renames</h3>
            {report.possibleRenames.length ? (
              report.possibleRenames.map((rename) => (
                <div
                  className="drift-change-row"
                  key={`${rename.oldColumn}-${rename.newColumn}`}
                >
                  <div className="drift-change-main">
                    <strong>
                      {rename.oldColumn} → {rename.newColumn}
                    </strong>
                    <span className="drift-review">
                      Requires review
                    </span>
                  </div>
                  <p>{rename.explanation}</p>
                  <small>
                    Name similarity:{" "}
                    {(rename.nameSimilarity * 100).toFixed(1)}% · Value
                    overlap: {(rename.valueOverlap * 100).toFixed(1)}%
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">No possible renames detected.</p>
            )}
          </div>

          <div className="drift-result-card">
            <h3>Column-level changes</h3>
            {report.changes.length ? (
              report.changes.map((change, index) => (
                <div
                  className="drift-change-row"
                  key={`${change.column}-${change.changeType}-${index}`}
                >
                  <div className="drift-change-main">
                    <strong>{change.column}</strong>
                    <span className="drift-change-type">
                      {changeTitle(change.changeType)}
                    </span>
                  </div>

                  {change.oldValue !== undefined && (
                    <p>
                      Old: <code>{String(change.oldValue)}</code>
                      {" → "}
                      New: <code>{String(change.newValue)}</code>
                    </p>
                  )}

                  {change.addedCategories && (
                    <p>
                      Added categories:{" "}
                      {change.addedCategories.join(", ") || "None"}
                    </p>
                  )}

                  {change.removedCategories && (
                    <p>
                      Removed categories:{" "}
                      {change.removedCategories.join(", ") || "None"}
                    </p>
                  )}

                  {change.distributionChanges?.map((item) => (
                    <p key={item.category}>
                      {item.category}: {item.oldPercentage}% →{" "}
                      {item.newPercentage}%
                    </p>
                  ))}

                  {change.explanation && <p>{change.explanation}</p>}
                </div>
              ))
            ) : (
              <p className="muted">No column-level changes detected.</p>
            )}
          </div>

<div className="drift-result-card">
  <h3>Row-level changes</h3>

  {report.rowChanges?.status === "compared" ? (
    <>
      <p className="muted">
        Records matched using: {report.rowChanges.keyColumn}
      </p>

      <div className="drift-stats">
        <div className="drift-stat">
          <span>Added records</span>
          <strong>{report.rowChanges.addedRows.length}</strong>
        </div>

        <div className="drift-stat">
          <span>Removed records</span>
          <strong>{report.rowChanges.removedRows.length}</strong>
        </div>

        <div className="drift-stat">
          <span>Modified records</span>
          <strong>{report.rowChanges.modifiedRows.length}</strong>
        </div>
      </div>

      <h4>Added records</h4>
      {report.rowChanges.addedRows.length ? (
        report.rowChanges.addedRows.map((row, index) => (
          <div className="drift-change-row" key={index}>
            {Object.entries(row).map(([field, value]) => (
              <p key={field}>
                <strong>{field}:</strong> {String(value ?? "—")}
              </p>
            ))}
          </div>
        ))
      ) : (
        <p className="muted">No added records.</p>
      )}

      <h4>Removed records</h4>
      {report.rowChanges.removedRows.length ? (
        report.rowChanges.removedRows.map((row, index) => (
          <div className="drift-change-row" key={index}>
            {Object.entries(row).map(([field, value]) => (
              <p key={field}>
                <strong>{field}:</strong> {String(value ?? "—")}
              </p>
            ))}
          </div>
        ))
      ) : (
        <p className="muted">No removed records.</p>
      )}

      <h4>Modified records</h4>
      {report.rowChanges.modifiedRows.length ? (
        report.rowChanges.modifiedRows.map((row) => (
          <div className="drift-change-row" key={row.key}>
            <strong>
              {report.rowChanges.keyColumn}: {row.key}
            </strong>

            {Object.entries(row.changes).map(([field, values]) => (
              <p key={field}>
                <strong>{field}:</strong>{" "}
                {String(values.oldValue ?? "—")} →{" "}
                {String(values.newValue ?? "—")}
              </p>
            ))}
          </div>
        ))
      ) : (
        <p className="muted">No modified records.</p>
      )}

      <p className="muted">{report.rowChanges.note}</p>
    </>
  ) : (
    <p className="muted">
      {report.rowChanges?.note ??
        "Row-level comparison is unavailable in this report."}
    </p>
  )}
</div>


          <div className="drift-result-card">
            <h3>Shared columns</h3>
            <p className="muted">
              {report.commonColumns.length
                ? report.commonColumns.join(", ")
                : "No shared columns"}
            </p>
          </div>

          <div className="drift-result-card">
            <h3>Interpretation notes</h3>
            <ul className="drift-limitations">
              {report.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

export default SchemaDrift;
