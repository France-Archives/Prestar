// Server/controllers/renewalController.js
import {
  createRenewal,
  listLoanRenewals,
  listMyRenewals,
  listStaffRenewals,
  RenewalError,
} from "../services/renewalService.js";

export async function handleCreateRenewal(req, res) {
  try {
    const loanId = req.validatedLoanId ?? req.resourceId ?? req.params.loanId ?? req.params.id;
    const requestedDurationDays = req.validatedDurationDays ?? req.body?.requestedDurationDays ?? 7;
    const userId = req.user?.id ?? req.user?.user_id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const result = await createRenewal({
      loanId,
      userId,
      requestedDurationDays,
      userRole,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof RenewalError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
        reasons: error.reasons,
      });
    }
    console.error("Create renewal error:", error);
    return res.status(500).json({ error: error?.message || "Internal server error." });
  }
}

export async function handleListMyRenewals(req, res) {
  try {
    const userId = req.user?.id ?? req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const result = await listMyRenewals(userId);
    return res.status(200).json({
      data: result,
      renewals: result,
    });
  } catch (error) {
    if (error instanceof RenewalError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("List my renewals error:", error);
    return res.status(500).json({ error: error?.message || "Internal server error." });
  }
}

export async function handleListLoanRenewals(req, res) {
  try {
    const loanId = req.validatedLoanId ?? req.resourceId ?? req.params.loanId ?? req.params.id;
    const result = await listLoanRenewals(loanId, req.user);
    return res.status(200).json({
      data: result,
      renewals: result,
    });
  } catch (error) {
    if (error instanceof RenewalError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("List loan renewals error:", error);
    return res.status(500).json({ error: error?.message || "Internal server error." });
  }
}

export async function handleListStaffRenewals(req, res) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const result = await listStaffRenewals({ search });
    return res.status(200).json({
      data: result,
      renewals: result,
    });
  } catch (error) {
    if (error instanceof RenewalError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("List staff renewals error:", error);
    return res.status(500).json({ error: error?.message || "Internal server error." });
  }
}
