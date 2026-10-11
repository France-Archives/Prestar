// Server/models/EmailOtp.js
import { DataTypes } from "sequelize";

export default function defineEmailOtp(sequelize) {
  return sequelize.define(
    "EmailOtp",
    {
      otp_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      otp_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      signup_payload: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      attempts: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
      resend_count: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 1,
      },
      last_sent_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "email_otps",
      timestamps: false,
      underscored: true,
    },
  );
}
