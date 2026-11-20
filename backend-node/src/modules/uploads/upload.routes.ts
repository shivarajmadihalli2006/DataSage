import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { uploadMiddleware, postUploadValidate } from "./upload.controller.js";
import { authenticate } from "../auth/auth.middleware.js";

export const uploadRouter = Router();

uploadRouter.post(
  "/uploads/validate",
  authenticate,
  uploadMiddleware,
  asyncHandler(postUploadValidate)
);