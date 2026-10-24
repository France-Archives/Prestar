// Server/models/Book.js
import { DataTypes } from "sequelize";

export default function defineBook(sequelize) {
  return sequelize.define("Book", {
    book_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    category_id: { type: DataTypes.BIGINT, allowNull: false },
    author_id: { type: DataTypes.BIGINT, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    isbn: { type: DataTypes.STRING(20), allowNull: false },
    publisher: { type: DataTypes.STRING(255), allowNull: true },
    year_published: { type: DataTypes.INTEGER, allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    cover_image: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "Active" },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { tableName: "books", timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });
}
