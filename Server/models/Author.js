// Server/models/Author.js
import { DataTypes } from "sequelize";

export default function defineAuthor(sequelize) {
  return sequelize.define("Author", {
    author_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    first_name: { type: DataTypes.STRING(100), allowNull: false },
    last_name: { type: DataTypes.STRING(100), allowNull: false },
    biography: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { tableName: "authors", timestamps: false });
}
