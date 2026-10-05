// Server/models/SignupVerification.js
import { DataTypes } from "sequelize";

export default function defineSignupVerification(sequelize) {
  return sequelize.define("SignupVerification", {
    verification_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    signup_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    actor_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: "signup_verifications",
    timestamps: false,
  });
}