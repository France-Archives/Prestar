// Server/models/BorrowRequest.js
import { DataTypes } from "sequelize";

export default function defineBorrowRequest(sequelize) {
  return sequelize.define(
    "BorrowRequest",
    {
      request_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      book_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      requested_days: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      request_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Pending",
      },
      reviewed_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      pickup_deadline: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "borrow_requests",
      timestamps: false,
      underscored: true,
    },
  );
}
