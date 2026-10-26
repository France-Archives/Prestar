// Server/models/Payment.js
import { DataTypes } from "sequelize";

export default function definePayment(sequelize) {
  return sequelize.define(
    "Payment",
    {
      payment_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      penalty_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      payment_method: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Cash",
      },
      payment_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Pending",
      },
      transaction_reference: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      receipt_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      paid_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      received_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      remarks: {
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
      tableName: "payments",
      timestamps: false,
      underscored: true,
    },
  );
}
