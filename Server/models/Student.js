// Server/models/Student.js
import { DataTypes } from "sequelize";

export default function defineStudent(sequelize) {
  return sequelize.define("Student", {
    student_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    course_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    year_level: {
      type: DataTypes.SMALLINT,
      allowNull: true,
    },
    enrollment_status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: "students",
    timestamps: false,
  });
}