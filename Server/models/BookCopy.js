// Server/models/BookCopy.js
import { DataTypes } from "sequelize";

export default function defineBookCopy(sequelize) {
  return sequelize.define("BookCopy", {
    copy_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    book_id: { type: DataTypes.BIGINT, allowNull: false },
    accession_no: { type: DataTypes.STRING(50), allowNull: false },
    condition_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "Good" },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "Available" },
    shelf_location: { type: DataTypes.STRING(100), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { tableName: "book_copies", timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });
}
