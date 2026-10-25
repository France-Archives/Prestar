// Server/models/Admin.js
import { DataTypes } from "sequelize";

export default function defineAdmin(sequelize) {
  return sequelize.define(
    "Admin",
    {
      user_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
      },
      employee_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      tableName: "admins",
      timestamps: false,
      underscored: true,
    },
  );
}
