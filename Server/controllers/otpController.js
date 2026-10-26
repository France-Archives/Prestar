// Server/controllers/otpController.js
import { requestOtp, verifyOtp, OtpError } from "../services/otpService.js";

export async function handleOtpRequest(req, res, next) {
	try {
		const result = await requestOtp(req.body.email, req.ip);
		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof OtpError) {
			return res.status(error.status).json({ message: error.message });
		}
		return next(error);
	}
}

export async function handleOtpVerify(req, res, next) {
	try {
		const result = await verifyOtp(req.body.email, req.body.code);
		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof OtpError) {
			return res.status(error.status).json({ error: error.message });
		}
		return next(error);
	}
}
