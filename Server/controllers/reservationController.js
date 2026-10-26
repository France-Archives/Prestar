// Server/controllers/reservationController.js
import {
  ReservationError,
  cancelReservation,
  createReservation,
  listMyReservations,
  listReservationsStaff,
} from "../services/reservationService.js";

export async function create(req, res) {
  try {
    const rawBookId = req.body.book_id ?? req.body.bookId;
    const bookId = Number(rawBookId);
    if (!Number.isSafeInteger(bookId) || bookId <= 0) {
      return res.status(400).json({ message: "book_id must be a positive integer." });
    }

    const requestedDays = req.body.requested_days ?? req.body.requestedDays ?? req.body.requestedDurationDays ?? 7;

    const result = await createReservation({
      userId: req.user.id,
      bookId,
      requestedDays: Number(requestedDays) || 7,
    });

    return res.status(201).json({
      message: "You have joined the reservation queue successfully.",
      reservation: result,
    });
  } catch (error) {
    if (error instanceof ReservationError) {
      return res.status(error.status || 400).json({
        message: error.message,
      });
    }
    console.error("Create reservation error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}

export async function listMine(req, res) {
  try {
    const result = await listMyReservations(req.user.id, req.query);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ReservationError) {
      return res.status(error.status || 400).json({
        message: error.message,
      });
    }
    console.error("List my reservations error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}

export async function cancel(req, res) {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isSafeInteger(reservationId) || reservationId <= 0) {
      return res.status(400).json({ message: "Invalid reservation ID." });
    }

    const result = await cancelReservation({
      reservationId,
      userId: req.user.id,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ReservationError) {
      return res.status(error.status || 400).json({
        message: error.message,
      });
    }
    console.error("Cancel reservation error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}

export async function listQueue(req, res) {
  try {
    const result = await listReservationsStaff(req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error("List reservations queue error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}

export default {
  create,
  listMine,
  cancel,
  listQueue,
};
