import * as dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5050", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgrespassword@localhost:5432/omni_hr_db",
  jwtSecret:
    process.env.JWT_SECRET ||
    "super_secret_jwt_key_omni_hr_development_2026_replace_in_prod",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    "super_secret_refresh_key_omni_hr_development_2026_replace_in_prod",
};
