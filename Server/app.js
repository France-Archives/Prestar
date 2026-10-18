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
app.use(express.json());
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
app.use("/api/otp", otpRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api", studentDashboardRoutes);
app.use("/api", verificationRoutes);

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
