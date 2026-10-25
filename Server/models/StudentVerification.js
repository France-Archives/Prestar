// Server/models/StudentVerification.js
import { DataTypes } from "sequelize";

export default function defineStudentVerification(sequelize) {
  return sequelize.define(
    "StudentVerification",
    {
      verification_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      term_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      proof_file: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Pending",
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      reviewed_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      valid_from: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      valid_until: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "student_verifications",
      timestamps: false,
      underscored: true,
    },
  );
}
