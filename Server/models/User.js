// Server/models/User.js
import { DataTypes } from "sequelize";

export default function defineUser(sequelize) {
  return sequelize.define(
    "User",
    {
      user_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      id: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue("user_id");
        },
        set(val) {
          this.setDataValue("user_id", val);
        },
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
        type: DataTypes.STRING(20),
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
      email_verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "users",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      defaultScope: {
        attributes: { exclude: ["password_hash"] },
      },
    },
  );
}