// Server/controllers/signupController.js
import { createSignup, SignupError } from "../services/signupService.js";

export async function signup(req, res, next) {
  try {
    const result = await createSignup({
      ...req.body,
      // File upload middleware, when configured, must supply a server-generated
      // storage key here. Never accept an arbitrary host filesystem path.
      proof_file: req.file?.storageKey ?? null,
    });

    if (result.matched) {
      return res.status(201).json({
        message: "Account created successfully.",
        reference_no: result.referenceNo,
        user: result.user,
      });
    }

    return res.status(202).json({
      message: "Your request was received and is pending review.",
      reference_no: result.referenceNo,
    });
  } catch (error) {
    if (error instanceof SignupError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
}