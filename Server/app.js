// Server/app.js
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";

const app = express();
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
