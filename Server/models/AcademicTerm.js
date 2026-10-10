// Server/models/AcademicTerm.js
import { DataTypes } from "sequelize";

export default function defineAcademicTerm(sequelize) {
  return sequelize.define(
    "AcademicTerm",
    {
      term_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      term_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      cor_deadline: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Active",
      },
    },
    {
      tableName: "academic_terms",
      timestamps: true,
      underscored: true,
    },
  );
}
