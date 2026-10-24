// Server/controllers/verificationController.js
import fs from "node:fs";
import path from "node:path";
import {
  approveStudentVerification,
  expireOverdueVerifications,
  formatDateOnly,
  formatVerification,
  getOrCreateTermForDate,
  listAcademicTerms,
  rejectStudentVerification,
} from "../services/academicTermService.js";
import { AcademicTerm, Student, StudentVerification, User } from "../models/index.js";
import { createNotification } from "../services/notificationService.js";
import {
  detectMimeType,
  resolveCorFilePath,
  saveBase64CorImage,
  verifyDiskFileSignature,
} from "../utils/fileStorage.js";

/**
 * GET /api/academic-terms
 */
export async function getTerms(req, res, next) {
  try {
    const terms = await listAcademicTerms();
    return res.status(200).json(terms);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/me/verifications or GET /api/verifications/me
 */
export async function getMyVerifications(req, res, next) {
  try {
    await expireOverdueVerifications();

    const verifications = await StudentVerification.findAll({
      where: { user_id: req.user.id },
      include: [{ model: AcademicTerm, as: "term" }],
      order: [["submitted_at", "DESC"]],
    });

    const formatted = verifications.map((v) => {
      const base = formatVerification(v);
      return {
        ...base,
        originalFileName: v.proof_file,
        proofFile: v.proof_file,
      };
    });
    return res.status(200).json(formatted);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/me/verifications/:id
 * Student views details of their own verification record (owner only).
 */
export async function getMyVerificationDetails(req, res, next) {
  try {
    await expireOverdueVerifications();

    const verificationId = req.params.id;
    const verification = await StudentVerification.findByPk(verificationId, {
      include: [{ model: AcademicTerm, as: "term" }],
    });

    if (!verification) {
      return res.status(404).json({ error: "Verification record not found." });
    }

    if (String(verification.user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "You are not authorized to view this verification." });
    }

    const base = formatVerification(verification);
    return res.status(200).json({
      ...base,
      originalFileName: verification.proof_file,
      proofFile: verification.proof_file,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/me/verifications or POST /api/verifications
 * Student submits COR document proof (realtime photo or file upload).
 */
export async function submitVerification(req, res, next) {
  try {
    const userId = req.user.id;
    let storedFileName = null;
    let originalFileName = "cor_proof.jpg";

    const candidateData =
      req.body?.image ||
      req.body?.file ||
      req.body?.proof_file ||
      req.body?.proofFile;

    const isDataUrl =
      typeof candidateData === "string" &&
      candidateData.startsWith("data:image/");

    // 1. Check if uploaded via multer (multipart/form-data)
    if (req.file) {
      if (req.file.size === 0) {
        return res.status(400).json({ error: "Uploaded file cannot be empty." });
      }
      if (req.file.path) {
        const signature = await verifyDiskFileSignature(req.file.path);
        if (!signature) {
          try {
            if (fs.existsSync(req.file.path)) {
              await fs.promises.unlink(req.file.path);
            }
          } catch (_) {}
          return res.status(400).json({
            error: "Invalid file content. Real file signature does not match allowed image types (JPEG, PNG, WebP).",
          });
        }
      }
      storedFileName = req.file.filename;
      originalFileName = req.file.originalname;
    }
    // 2. Check if sent as base64 / data URL (e.g. from camera capture)
    else if (isDataUrl) {
      const saved = await saveBase64CorImage(
        userId,
        candidateData,
        req.body?.originalFileName || "camera_cor.jpg"
      );
      storedFileName = saved.filename;
      originalFileName = saved.originalName;
    }
    // 3. Reject empty or invalid submissions
    else {
      return res.status(400).json({
        error: "A valid realtime captured image (data:image/... or camera image upload) is required.",
      });
    }

    // Resolve active term
    const term = await getOrCreateTermForDate(new Date());

    // Mark previous pending uploads for the same term as superseded
    await StudentVerification.update(
      { status: "Superseded" },
      {
        where: {
          user_id: userId,
          term_id: term.term_id,
          status: "Pending",
        },
      },
    );

    const verification = await StudentVerification.create({
      user_id: userId,
      term_id: term.term_id,
      proof_file: storedFileName,
      status: "Pending",
      submitted_at: new Date(),
    });

    // Create notification for student
    try {
      await createNotification({
        userId,
        type: "COR_SUBMITTED",
        title: "COR submitted",
        message: `Your COR was submitted for ${term.term_name || "the active term"} and is awaiting review.`,
        relatedEntityType: "STUDENT_VERIFICATION",
        relatedEntityId: verification.verification_id,
      });
    } catch (notifErr) {
      console.warn("[Notification] Error creating COR_SUBMITTED notification:", notifErr.message);
    }

    return res.status(201).json({
      ...formatVerification(verification, term),
      originalFileName,
      proofFile: storedFileName,
    });
  } catch (error) {
    return next(error);
  }
}

export const STAFF_VERIFICATION_INCLUDES = [
  { model: AcademicTerm, as: "term" },
  {
    model: User,
    as: "user",
    attributes: ["user_id", "first_name", "last_name", "email", "role"],
    include: [
      {
        model: Student,
        as: "student",
        attributes: [
          "student_number",
          "middle_name",
          "suffix",
          "college",
          "course",
          "year_level",
          "student_type",
        ],
      },
    ],
  },
  {
    model: User,
    as: "reviewer",
    attributes: ["user_id", "first_name", "last_name", "email", "role"],
  },
];

export function formatStaffVerification(verification) {
  const v = typeof verification?.get === "function" ? verification.get({ plain: true }) : verification;
  if (!v) return null;

  const base = formatVerification(v, v.term);
  const studentUser = v.user;
  const studentProfile = studentUser?.student || v.student;
  const reviewerUser = v.reviewer;

  const fullName = studentUser
    ? `${studentUser.first_name || ""} ${studentUser.last_name || ""}`.trim()
    : "";

  return {
    ...base,
    originalFileName: v.proof_file,
    proofFile: v.proof_file,
    student: studentUser
      ? {
          id: String(studentUser.user_id),
          studentNumber: studentProfile?.student_number || "",
          name: fullName,
          email: studentUser.email,
          college: studentProfile?.college || null,
          course: studentProfile?.course || null,
          yearLevel: studentProfile?.year_level ?? null,
          studentType: studentProfile?.student_type || null,
        }
      : null,
    reviewer: reviewerUser
      ? {
          id: String(reviewerUser.user_id),
          name: `${reviewerUser.first_name || ""} ${reviewerUser.last_name || ""}`.trim(),
          email: reviewerUser.email,
          role: reviewerUser.role,
        }
      : null,
  };
}

/**
 * GET /api/staff/verifications (and aliases: /api/admin/verifications, /api/librarian/verifications, /api/verifications)
 * Librarian or Admin views queue with student details, status filtering, and search capability.
 */
export async function getStaffQueue(req, res, next) {
  try {
    await expireOverdueVerifications();

    const { status, search } = req.query;
    const where = {};

    if (status && String(status).trim().toUpperCase() !== "ALL") {
      const statusStr = String(status).trim();
      const STATUS_MAP = {
        pending: "Pending",
        approved: "Approved",
        rejected: "Rejected",
        expired: "Expired",
        superseded: "Superseded",
      };
      where.status =
        STATUS_MAP[statusStr.toLowerCase()] ||
        (statusStr.charAt(0).toUpperCase() + statusStr.slice(1).toLowerCase());
    }

    const verifications = await StudentVerification.findAll({
      where,
      include: STAFF_VERIFICATION_INCLUDES,
      order: [["submitted_at", "DESC"]],
    });

    let formatted = verifications.map((v) => formatStaffVerification(v));

    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      formatted = formatted.filter((item) => {
        const student = item.student;
        return (
          student?.name?.toLowerCase().includes(q) ||
          student?.studentNumber?.toLowerCase().includes(q) ||
          student?.email?.toLowerCase().includes(q) ||
          student?.college?.toLowerCase().includes(q) ||
          student?.course?.toLowerCase().includes(q) ||
          item.termName?.toLowerCase().includes(q) ||
          item.originalFileName?.toLowerCase().includes(q) ||
          item.proofFile?.toLowerCase().includes(q) ||
          item.status?.toLowerCase().includes(q) ||
          item.remarks?.toLowerCase().includes(q) ||
          item.rejectionReason?.toLowerCase().includes(q)
        );
      });
    }

    // Sort: Pending submissions first, then newest first
    formatted.sort((a, b) => {
      const aPending = a.status === "Pending" ? 0 : 1;
      const bPending = b.status === "Pending" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bTime - aTime;
    });

    return res.status(200).json(formatted);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/staff/verifications/:id (and aliases: /api/admin/verifications/:id, /api/librarian/verifications/:id, /api/verifications/:id)
 * Librarian or Admin views details of a verification record.
 */
export async function getStaffVerificationDetails(req, res, next) {
  try {
    await expireOverdueVerifications();

    const verificationId = req.params.id;
    const verification = await StudentVerification.findByPk(verificationId, {
      include: STAFF_VERIFICATION_INCLUDES,
    });

    if (!verification) {
      return res.status(404).json({ error: "Verification record not found." });
    }

    return res.status(200).json(formatStaffVerification(verification));
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/staff/verifications/:id/approve (and aliases: /api/admin/verifications/:id/approve, /api/librarian/verifications/:id/approve, /api/verifications/:id/approve)
 * Approves COR:
 * - Updates status to 'Approved'
 * - Sets valid_from to approval date
 * - Sets valid_until to end of term
 * - Creates a COR_APPROVED notification
 */
export async function approveVerificationHandler(req, res, next) {
  try {
    const verificationId = req.params.id;
    const reviewerId = req.user.id;
    const remarks = req.body?.remarks || "Approved";

    const result = await approveStudentVerification({
      verificationId,
      reviewerId,
      approvalDate: new Date(),
      remarks,
    });

    // Notify the student
    if (result.userId) {
      try {
        await createNotification({
          userId: result.userId,
          type: "COR_APPROVED",
          title: "COR approved",
          message: `Your COR for ${result.termName || "the active term"} was approved. It is valid until ${result.validUntil}. You can now borrow books.`,
          relatedEntityType: "STUDENT_VERIFICATION",
          relatedEntityId: verificationId,
        });
      } catch (notifErr) {
        console.warn("[Notification] Error creating COR_APPROVED notification:", notifErr.message);
      }
    }

    const updated = await StudentVerification.findByPk(verificationId, {
      include: STAFF_VERIFICATION_INCLUDES,
    });

    return res.status(200).json(updated ? formatStaffVerification(updated) : result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/staff/verifications/:id/reject (and aliases: /api/admin/verifications/:id/reject, /api/librarian/verifications/:id/reject, /api/verifications/:id/reject)
 * Rejects COR:
 * - Updates status to 'Rejected'
 * - Records rejection reason in remarks
 * - Creates a COR_REJECTED notification
 * - Student remains unverified
 */
export async function rejectVerificationHandler(req, res, next) {
  try {
    const verificationId = req.params.id;
    const reviewerId = req.user.id;
    const reason = req.body?.reason || req.body?.remarks;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "A reason is required to reject a COR." });
    }

    const result = await rejectStudentVerification({
      verificationId,
      reviewerId,
      remarks: reason.trim(),
      rejectionDate: new Date(),
    });

    // Notify the student
    if (result.userId) {
      try {
        await createNotification({
          userId: result.userId,
          type: "COR_REJECTED",
          title: "COR not approved",
          message: `Your COR was not approved. Reason: ${reason.trim()}. Upload a corrected document for review.`,
          relatedEntityType: "STUDENT_VERIFICATION",
          relatedEntityId: verificationId,
        });
      } catch (notifErr) {
        console.warn("[Notification] Error creating COR_REJECTED notification:", notifErr.message);
      }
    }

    const updated = await StudentVerification.findByPk(verificationId, {
      include: STAFF_VERIFICATION_INCLUDES,
    });

    return res.status(200).json(updated ? formatStaffVerification(updated) : result);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/staff/verifications/:id/document or GET /api/me/verifications/:id/document
 * Securely streams the stored COR document to authorized reviewers (Admin, Librarian) or the student owner.
 */
export async function streamVerificationDocument(req, res, next) {
  try {
    const verificationId = req.params.id;
    const verification = await StudentVerification.findByPk(verificationId);

    if (!verification) {
      return res.status(404).json({ error: "Verification record not found." });
    }

    // Authorization check: Only Admin, Librarian, or the student owner
    const isStaff = ["Admin", "Librarian"].includes(req.user.role);
    const isOwner = String(verification.user_id) === String(req.user.id);

    if (!isStaff && !isOwner) {
      return res.status(403).json({ error: "You are not authorized to view this document." });
    }

    const filePath = resolveCorFilePath(verification.proof_file);
    if (!filePath) {
      return res.status(404).json({
        error: "Document file not found in storage.",
        fileName: verification.proof_file,
      });
    }

    const mimeType = detectMimeType(filePath);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(filePath)}"`);
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    return next(error);
  }
}
