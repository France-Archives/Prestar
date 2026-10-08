// Server/controllers/signupController.js
import {
  attachSignupProof,
  createSignup,
  SignupError,
  verifyProofUploadCapability,
} from "../services/signupService.js";

export async function signup(req, res, next) {
  try {
    const result = await createSignup({
      ...req.body,
    });

    if (result.matched) {
      return res.status(201).json({
        message: "Account created successfully.",
        reference_no: result.referenceNo,
        user: result.user,
      });
    }

    return res.status(202).json({
      message: "Your request was received. Upload proof of enrollment to complete your pending request.",
      reference_no: result.referenceNo,
      proof_required: true,
      proof_upload_url: `/api/auth/signup/${encodeURIComponent(result.referenceNo)}/proof`,
      proof_upload_token: result.proofUpload.token,
      proof_upload_expires_at: result.proofUpload.expiresAt,
    });
  } catch (error) {
    if (error instanceof SignupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
}

export async function uploadSignupProof(req, res, next) {
  try {
    if (!req.file) {
      throw new SignupError(400, "A proof image is required in the 'proof' field.");
    }

    await attachSignupProof(
      req.params.referenceNo,
      req.file.buffer,
      req.file.mimetype,
    );

    return res.status(200).json({
      message: "Proof of enrollment uploaded successfully. Your request is pending review.",
      reference_no: req.params.referenceNo,
      proof_uploaded: true,
    });
  } catch (error) {
    if (error instanceof SignupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
}

export function authorizeSignupProofUpload(req, res, next) {
  const authorization = req.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    return res.status(401).json({ error: "A proof upload token is required." });
  }

  try {
    verifyProofUploadCapability(match[1], req.params.referenceNo);
    return next();
  } catch (error) {
    if (error instanceof SignupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
}