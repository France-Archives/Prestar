// Server/server.js
import app from "./app.js";
import { startOtpCleanup } from "./services/otpService.js";

const PORT = Number(process.env.PORT || 3000);

startOtpCleanup();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});