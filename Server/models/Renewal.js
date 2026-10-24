// Server/models/Renewal.js
import { DataTypes } from "sequelize";

export default function defineRenewal(sequelize) {
  return sequelize.define(
    "Renewal",
    {
      renewal_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      borrow_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      requested_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      old_due_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      requested_duration_days: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      requested_due_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      renewal_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Pending",
      },
      reviewed_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      new_due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "renewals",
      timestamps: false,
      underscored: true,
    },
  );
}
