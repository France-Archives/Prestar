// Server/models/College.js
import { DataTypes } from "sequelize";

export default function defineCollege(sequelize) {
  return sequelize.define("College", {
    college_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    college_code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    college_name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: "colleges",
    timestamps: false,
  });
}