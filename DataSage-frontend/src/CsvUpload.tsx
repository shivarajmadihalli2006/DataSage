
import { useRef, useState } from "react";
import QualityDashboard from "./QualityDashboard";

type CsvUploadProps = {
  searchQuery?: string;
};

type UploadResult = {
  projectId?: string;
  versionId?: string;
  project?: { id?: string };
  version?: { id?: string };
  data?: UploadResult;
  result?: UploadResult;
  message?: string;
  [key: string]: unknown;
};

type UploadedFile = {
  name: string;
  size: number;
  status: "ready" | "uploading" | "success" | "error";
  message?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function CsvUpload({ searchQuery = "" }: CsvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [dashboardIds, setDashboardIds] = useState<{
    projectId: string;
    versionId: string;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const addFiles = (incoming: FileList | File[]) => {
    const candidates = Array.from(incoming);
    if (!candidates.length) return;

    const invalidFiles = candidates.filter(
      (file) => !file.name.toLowerCase().endsWith(".csv"),
    );

    if (invalidFiles.length) {
      setError(
        `Only CSV files are supported. Please remove: ${invalidFiles
          .map((file) => file.name)
          .join(", ")}`,
      );
      return;
    }

    setSelectedFiles((previous) => {
      const existingNames = new Set(previous.map((file) => file.name));
      const combined = [
        ...previous,
        ...candidates.filter((file) => !existingNames.has(file.name)),
      ];

      setFiles(
        combined.map((file) => ({
          name: file.name,
          size: file.size,
          status: "ready",
        })),
      );

      return combined;
    });

    setError("");
    setSuccessMessage("");
    setDashboardIds(null);
    setUploadProgress(0);
  };

  const removeFile = (name: string) => {
    setSelectedFiles((previous) => {
      const updated = previous.filter((file) => file.name !== name);

      setFiles(
        updated.map((file) => ({
          name: file.name,
          size: file.size,
          status: "ready",
        })),
      );

      return updated;
    });

    setError("");
    setSuccessMessage("");
    setDashboardIds(null);
  };

  
const handleUpload = async () => {
  if (!selectedFiles.length) {
    setError("Choose at least one CSV file before starting the analysis.");
    return;
  }

  setUploading(true);
  setError("");
  setSuccessMessage("");
  setUploadProgress(10);
  setDashboardIds(null);

  setFiles((previous) =>
    previous.map((file) => ({ ...file, status: "uploading" }))
  );

  try {
    // Send ALL selected CSV files in ONE request.
    const formData = new FormData();

    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    setUploadProgress(30);

    const response = await fetch("/api/uploads/validate", {
      method: "POST",
      body: formData,
    });

    const responseText = await response.text();
    let parsed: UploadResult = {};

    if (responseText) {
      try {
        parsed = JSON.parse(responseText) as UploadResult;
      } catch {
        throw new Error("The server returned an unexpected response.");
      }
    }

    if (!response.ok) {
      throw new Error(
        typeof parsed.message === "string"
          ? parsed.message
          : `Upload failed with HTTP ${response.status}.`
      );
    }

    const result =
      parsed.data && typeof parsed.data === "object"
        ? parsed.data
        : parsed.result && typeof parsed.result === "object"
          ? parsed.result
          : parsed;

    const projectId = result.projectId ?? result.project?.id;
    const versionId = result.versionId ?? result.version?.id;

    if (
      typeof projectId !== "string" ||
      typeof versionId !== "string"
    ) {
      throw new Error(
        "The API response did not include projectId and versionId."
      );
    }

    setUploadProgress(90);
    setDashboardIds({ projectId, versionId });
    setUploadProgress(100);
    setSuccessMessage(
      `${selectedFiles.length} CSV file(s) uploaded and analyzed successfully.`
    );

    setFiles((previous) =>
      previous.map((file) => ({ ...file, status: "success" }))
    );
  } catch (uploadError: unknown) {
    const message =
      uploadError instanceof Error
        ? uploadError.message
        : "Something went wrong while uploading your datasets.";

    setError(message);

    setFiles((previous) =>
      previous.map((file) => ({
        ...file,
        status: "error",
        message,
      }))
    );
  } finally {
    setUploading(false);
  }
};


  const totalSize = selectedFiles.reduce(
    (sum, file) => sum + file.size,
    0,
  );

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="upload-workspace">
      <section
        className={`glass-panel upload-panel ${
          dragging ? "upload-panel-dragging" : ""
        }`}
        id="upload-section"
      >
        <div className="upload-panel-header">
          <div className="upload-heading-icon">⇧</div>

          <div className="upload-heading-copy">
            <p className="section-kicker">START EXPLORING</p>
            <h3>Bring your data to life.</h3>
            <p>
              Upload your dataset and let DataSage uncover its quality,
              structure, and hidden patterns.
            </p>
          </div>

          <div className="upload-header-decoration" aria-hidden="true">
            ✧
          </div>
        </div>

        <div
          className={`drop-zone ${dragging ? "is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Choose or drop CSV files"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          <div className="upload-cloud-icon" aria-hidden="true">
            <span>⇧</span>
          </div>

          <h4>
            {dragging ? "Drop your files here" : "Drop your data universe here"}
          </h4>

          <p>Drag and drop CSV files here, or choose files from your computer.</p>

          <button
            className="choose-files-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
            disabled={uploading}
          >
            <span>＋</span> Browse CSV files
          </button>

          <div className="upload-format">
            <span className="format-dot" />
            CSV files <span>·</span> Multiple files supported
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="selected-files-section">
            <div className="selected-files-heading">
              <div>
                <h4>Selected datasets</h4>
                <p>Review your files before analysis.</p>
              </div>

              <span className="file-count">
                {selectedFiles.length}{" "}
                {selectedFiles.length === 1 ? "file" : "files"}
              </span>
            </div>

            <div className="selected-files-list">
              {filteredFiles.map((file) => (
                <div className="selected-file" key={file.name}>
                  <div className="file-type-icon">▤</div>

                  <div className="selected-file-info">
                    <strong title={file.name}>{file.name}</strong>
                    <small>{formatFileSize(file.size)} · CSV file</small>
                  </div>

                  <span className={`file-status status-${file.status}`}>
                    {file.status === "ready" && "Ready"}
                    {file.status === "uploading" && "Uploading"}
                    {file.status === "success" && "✓ Complete"}
                    {file.status === "error" && "Failed"}
                  </span>

                  {!uploading && (
                    <button
                      className="remove-file-button"
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeFile(file.name)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="upload-summary">
              <span>Total upload size</span>
              <strong>{formatFileSize(totalSize)}</strong>
            </div>
          </div>
        )}

        {uploading && (
          <div className="upload-progress-section">
            <div className="progress-label">
              <span>Analyzing your dataset...</span>
              <strong>{uploadProgress}%</strong>
            </div>

            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="upload-message upload-error" role="alert">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="upload-message upload-success" role="status">
            <span>✓</span>
            <p>{successMessage}</p>
          </div>
        )}

        <div className="upload-action-row">
          <p className="upload-footnote">
            <span>🔒</span> Analysis starts when the server accepts your CSV.
          </p>

          <button
            className="analyze-button"
            type="button"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading ? (
              <>
                <span className="button-spinner" />
                Analyzing...
              </>
            ) : (
              <>
                <span>✧</span>
                Upload and analyze
                <span className="button-arrow">→</span>
              </>
            )}
          </button>
        </div>
      </section>

      {dashboardIds && (
        <section className="dashboard-result" id="quality-results">
          <div className="results-banner">
            <div>
              <p className="section-kicker">ANALYSIS RESULTS</p>
              <h2>Your data intelligence report</h2>
              <p>
                Quality metrics and findings returned by your DataSage API.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() =>
                document
                  .getElementById("upload-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              ↑ Upload another
            </button>
          </div>

          <QualityDashboard
            projectId={dashboardIds.projectId}
            versionId={dashboardIds.versionId}
            searchQuery={searchQuery}
          />
        </section>
      )}
    </div>
  );
}

export default CsvUpload;
