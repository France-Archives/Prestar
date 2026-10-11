// Server/models/BorrowedBook.js
import { DataTypes } from "sequelize";

export default function defineBorrowedBook(sequelize) {
  return sequelize.define(
    "BorrowedBook",
    {
      borrow_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      request_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      book_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      copy_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      borrow_date: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Reserved",
      },
      issued_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      assigned_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      assigned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      picked_up_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "borrowed_books",
      timestamps: false,
      underscored: true,
    },
  );
}
