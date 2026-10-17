// Server/models/Suspension.js
import { DataTypes } from "sequelize";

export default function defineSuspension(sequelize) {
  return sequelize.define("Suspension", {
    suspension_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT, allowNull: false },
    reason_type: { type: DataTypes.STRING(30), allowNull: false },
    reason_details: { type: DataTypes.TEXT, allowNull: false },
    borrow_id: { type: DataTypes.BIGINT, allowNull: true },
    suspended_by: { type: DataTypes.BIGINT, allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "Active" },
    lifted_by: { type: DataTypes.BIGINT, allowNull: true },
    lifted_at: { type: DataTypes.DATE, allowNull: true },
    lift_remarks: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { tableName: "suspensions", timestamps: false });
}
