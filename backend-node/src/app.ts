
import express from "express";
import swaggerUi from "swagger-ui-express";
import { requestId } from "./middleware/requestId.js";
import { accessLog } from "./middleware/accessLog.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { uploadRouter } from "./modules/uploads/upload.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { notFoundHandler, errorHandler } from "./errors/errorHandler.js";

const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "DataSage API",
    version: "1.0.0",
    description:
      "API documentation for the DataSage data quality and schema intelligence platform",
  },
  servers: [
    {
      url: "http://localhost:8000",
      description: "Local DataSage backend",
    },
  ],
  tags: [
    { name: "Health", description: "API health checks" },
    { name: "Uploads", description: "Dataset upload and profiling" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Check API health",
        responses: {
          "200": {
            description: "API is healthy",
          },
        },
      },
    },

    "/uploads/validate": {
      post: {
        tags: ["Uploads"],
        summary: "Upload and profile datasets",
        description:
          "Upload one or more dataset files for profiling. Optionally provide an existing projectId.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  files: {
                    type: "array",
                    items: {
                      type: "string",
                      format: "binary",
                    },
                    description: "Dataset files to upload",
                  },
                  projectId: {
                    type: "string",
                    description: "Optional existing project ID",
                  },
                },
                required: ["files"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Dataset profiled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "profiled",
                    },
                    projectId: { type: "string" },
                    versionId: { type: "string" },
                    jobId: { type: "string" },
                    versionNumber: { type: "integer" },
                    fileCount: { type: "integer" },
                    files: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          originalFilename: { type: "string" },
                          tableName: { type: "string" },
                          sizeBytes: { type: "integer" },
                          rowCount: { type: "integer" },
                          columnCount: { type: "integer" },
                          columnNames: {
                            type: "array",
                            items: { type: "string" },
                          },
                          checksumSha256: { type: "string" },
                        },
                      },
                    },
                    profiling: {
                      type: "object",
                      properties: {
                        findingCount: { type: "integer" },
                        issueCount: { type: "integer" },
                        relationshipCount: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid upload or dataset validation failed",
          },
          "404": {
            description: "Specified project was not found",
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
  },
};

/**
 * Builds the Express app without binding a port.
 */
export function createApp() {
  const app = express();

  app.use(express.json());

  // Request tracking and logging
  app.use(requestId);
  app.use(accessLog);

  // Swagger UI
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Existing application routes
  // Existing application routes
app.use(authRouter);
app.use(healthRouter);
  app.use(healthRouter);
  app.use(uploadRouter);
  app.use(projectsRouter);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
