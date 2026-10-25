// Server/utils/withActor.js
import { sequelize } from "../models/index.js";

/**
 * Executes a callback within a Sequelize transaction, setting the transaction-local
 * session variable 'app.user_id' if an actorId is supplied.
 *
 * Audit triggers (fn_prestar_audit_log) inspect current_setting('app.user_id', true)
 * to record which user performed the mutation.
 *
 * @param {number|string|null|undefined} actorId - Authenticated user_id or null for system actions
 * @param {(transaction: import("sequelize").Transaction) => Promise<any>} callback - Callback to execute within transaction
 * @returns {Promise<any>}
 */
export async function withActor(actorId, callback) {
  return sequelize.transaction(async (transaction) => {
    if (actorId !== undefined && actorId !== null && actorId !== "") {
      await sequelize.query("SELECT set_config('app.user_id', :actorId, true)", {
        replacements: { actorId: String(actorId) },
        transaction,
      });
    }
    return callback(transaction);
  });
}

export default withActor;
