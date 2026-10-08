// Server/models/Signup.js
import { DataTypes } from "sequelize";

export default function defineSignup(sequelize) {
  return sequelize.define("Signup", {
    signup_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    reference_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    submitted_student_no: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    student_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    student_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Regular",
    },
    submitted_course: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    submitted_year_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    previous_school: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    match_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Unmatched",
    },
    verification_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Manual",
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Pending",
    },
    proof_file: {
      // Legacy storage-key field; new proof uploads use proof_image.
      type: DataTypes.TEXT,
      allowNull: true,
    },
    proof_image: {
      type: DataTypes.BLOB,
      allowNull: true,
    },
    proof_mime_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    email_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    created_user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    manual_verified_until: {
      type: DataTypes.DATEONLY,
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
    tableName: "signups",
    timestamps: false,
  });
}