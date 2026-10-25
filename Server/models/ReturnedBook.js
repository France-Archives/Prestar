// Server/models/ReturnedBook.js
import { DataTypes } from "sequelize";

export default function defineReturnedBook(sequelize) {
  return sequelize.define(
    "ReturnedBook",
    {
      return_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      borrow_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      return_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      condition_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      days_overdue: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      received_by: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "returned_books",
      timestamps: false,
      underscored: true,
    },
  );
}
