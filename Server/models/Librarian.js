// Server/models/Librarian.js
import { DataTypes } from "sequelize";

export default function defineLibrarian(sequelize) {
  return sequelize.define(
    "Librarian",
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
      tableName: "librarians",
      timestamps: false,
      underscored: true,
    },
  );
}
