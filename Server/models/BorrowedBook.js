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
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      due_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Borrowed",
      },
      issued_by: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    {
      tableName: "borrowed_books",
      timestamps: false,
      underscored: true,
    },
  );
}
