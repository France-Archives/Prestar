// Server/models/Category.js
import { DataTypes } from "sequelize";

export default function defineCategory(sequelize) {
  return sequelize.define("Category", {
    category_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    category_name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { tableName: "categories", timestamps: false });
}
