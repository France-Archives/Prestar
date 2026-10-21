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

    const formatted = verifications.map((v) => formatVerification(v));
    return res.status(200).json(formatted);
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

    // 1. Check if uploaded via multer (multipart/form-data)
    if (req.file) {
      storedFileName = req.file.filename;
      originalFileName = req.file.originalname;
    }
    // 2. Check if sent as base64 / data URL (e.g. from camera capture)
    else {
      const candidateData =
        req.body?.image ||
        req.body?.file ||
        req.body?.proof_file ||
        req.body?.proofFile;

      if (typeof candidateData === "string" && candidateData.startsWith("data:")) {
        const saved = await saveBase64CorImage(userId, candidateData, req.body?.originalFileName || "camera_cor.jpg");
        storedFileName = saved.filename;
        originalFileName = saved.originalName;
      } else if (typeof candidateData === "string" && candidateData.trim()) {
        storedFileName = candidateData.trim();
        originalFileName = req.body?.originalFileName || storedFileName;
      } else {
        storedFileName = `cor_${userId}_${Date.now()}.jpg`;
      }
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

/**
 * GET /api/staff/verifications
 * Librarian or Admin views queue with student details.
 */
export async function getStaffQueue(req, res, next) {
  try {
    await expireOverdueVerifications();

    const { status, search } = req.query;
    const where = {};
    if (status) {
      where.status = status;
    }

    const verifications = await StudentVerification.findAll({
      where,
      include: [
        { model: AcademicTerm, as: "term" },
        {
          model: User,
          as: "user",
          attributes: ["user_id", "first_name", "last_name", "email", "role"],
          include: [
            {
              model: Student,
              as: "student",
              attributes: ["student_number", "college", "course"],
            },
          ],
        },
      ],
      order: [["submitted_at", "DESC"]],
    });

    const formatted = verifications.map((v) => {
      const base = formatVerification(v);
      const studentUser = v.user;
      const studentProfile = studentUser?.student;
      return {
        ...base,
        originalFileName: v.proof_file,
        proofFile: v.proof_file,
        student: studentUser
          ? {
              id: String(studentUser.user_id),
              studentNumber: studentProfile?.student_number || "",
              name: `${studentUser.first_name || ""} ${studentUser.last_name || ""}`.trim(),
              email: studentUser.email,
              college: studentProfile?.college || null,
              course: studentProfile?.course || null,
            }
          : null,
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/staff/verifications/:id/approve
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
    const remarks = req.body.remarks || "Approved";

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

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/staff/verifications/:id/reject
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
    const reason = req.body.reason || req.body.remarks;

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

    return res.status(200).json(result);
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
