// Server/models/Penalty.js
import { DataTypes } from "sequelize";

export default function definePenalty(sequelize) {
  return sequelize.define(
    "Penalty",
    {
      penalty_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      borrow_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      return_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      penalty_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Unpaid",
      },
      created_by: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      waived_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      waived_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      waive_remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "penalties",
      timestamps: false,
      underscored: true,
    },
  );
}
