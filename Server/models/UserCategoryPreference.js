// Server/models/UserCategoryPreference.js
import { DataTypes } from "sequelize";

export default function defineUserCategoryPreference(sequelize) {
  return sequelize.define(
    "UserCategoryPreference",
    {
      preference_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      category_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    {
      tableName: "user_category_preferences",
      timestamps: false,
      underscored: true,
    },
  );
}
