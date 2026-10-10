// Server/models/Student.js
import { DataTypes } from "sequelize";

export default function defineStudent(sequelize) {
  return sequelize.define(
    "Student",
    {
      user_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
      },
      student_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      college: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      course: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      year_level: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      student_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Regular",
      },
    },
    {
      tableName: "students",
      timestamps: false,
      underscored: true,
    },
  );
}