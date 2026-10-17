// Server/models/AuditLog.js
import { DataTypes } from "sequelize";

export default function defineAuditLog(sequelize) {
  return sequelize.define(
    "AuditLog",
    {
      audit_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      actor_user_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      entity_table: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      entity_id: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      old_values: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      new_values: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "audit_logs",
      timestamps: false,
      underscored: true,
    },
  );
}
