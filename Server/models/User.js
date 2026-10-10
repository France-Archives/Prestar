// Server/models/User.js
import { DataTypes } from "sequelize";

export default function defineUser(sequelize) {
  return sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        field: "user_id",
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password_hash: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Student",
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Active",
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
    },
    {
      tableName: "users",
      timestamps: true,
      underscored: true,
      defaultScope: {
        attributes: { exclude: ["password_hash"] },
      },
    },
  );
}