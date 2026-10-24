// Server/app.js
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import bookRoutes from "./routes/bookRoutes.js";
import borrowRequestRoutes from "./routes/borrowRequestRoutes.js";
import borrowedBookRoutes from "./routes/borrowedBookRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import reservationRoutes from "./routes/reservationRoutes.js";
import studentDashboardRoutes from "./routes/studentDashboardRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import staffDashboardRoutes from "./routes/staffDashboardRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import renewalRoutes from "./routes/renewalRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import { getAuthorsHandler } from "./controllers/bookController.js";

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = new Set(
	(process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean),
);

app.use(helmet());
app.use(morgan("common"));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());
app.use(cors({
	origin(origin, callback) {
		if (!origin || allowedOrigins.has(origin)) {
			return callback(null, true);
		}
		return callback(null, false);
	},
	credentials: true,
}));

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/borrow-requests", borrowRequestRoutes);
app.use("/api/borrowing-requests", borrowRequestRoutes);
app.use("/api/borrowed-books", borrowedBookRoutes);
app.use("/api/staff/loans", borrowedBookRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/renewals", renewalRoutes);
app.use("/api", studentDashboardRoutes);
app.use("/api", staffDashboardRoutes);
app.use("/api", verificationRoutes);

// Category routes (listing categories, creating categories, and books by category)
app.use("/api/categories", categoryRoutes);

// Catalog helper lists (authenticated, any role)
app.get("/api/authors", authMiddleware, getAuthorsHandler);

app.use((req, res) => {
	res.status(404).json({ error: "Route not found." });
});

app.use((error, _req, res, _next) => {
	console.error(error);
	const statusCode = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
		? error.status
		: 500;
	res.status(statusCode).json({
		error: statusCode === 500 ? "Internal server error." : error.message,
	});
});

export default app;
