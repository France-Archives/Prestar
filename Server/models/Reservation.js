// Server/models/Reservation.js
import { DataTypes } from "sequelize";

export default function defineReservation(sequelize) {
  return sequelize.define("Reservation", {
    reservation_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT, allowNull: false },
    book_id: { type: DataTypes.BIGINT, allowNull: false },
    reservation_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "Waiting" },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    closed_at: { type: DataTypes.DATE, allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
  }, { tableName: "reservations", timestamps: false });
}
