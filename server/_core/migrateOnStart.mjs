import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";

const REQUIRED_TABLES = [
  "users",
  "adminSecurity",
  "paymentConfirmationEmails",
  "fulfillmentNotificationEmails",
  "merchantTeams",
  "merchantEmployeeAccounts",
  "merchantTeamMembers",
  "merchantDashboardProfiles",
  "merchantOrders",
  "merchantDashboardLoginAudits",
  "merchantInventory",
  "subscriptionDeliveryRecords",
  "subscriptionReminderSettings",
  "demoOrderCleanupSettings",
  "subscriptionReminderDispatches",
];

function fail(message) {
  console.error(`[Database bootstrap] ${message}`);
  process.exit(1);
}

async function getMissingTables() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) fail("DATABASE_URL is required. Add a MySQL-compatible database URL in Render before deploying.");

  const connection = await mysql.createConnection(url);
  try {
    const [rows] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    const available = new Set(rows.map((row) => row.table_name));
    return REQUIRED_TABLES.filter((table) => !available.has(table));
  } finally {
    await connection.end();
  }
}

async function main() {
  let missing;
  try {
    missing = await getMissingTables();
  } catch (error) {
    fail(`Could not reach the configured database. Check DATABASE_URL, TiDB public access, and TLS. ${error instanceof Error ? error.message : ""}`.trim());
  }

  if (missing.length === 0) {
    console.log("[Database bootstrap] Existing 91DAB schema detected; migrations already applied.");
    return;
  }

  if (missing.length !== REQUIRED_TABLES.length) {
    fail(`Database schema is incomplete. Missing tables: ${missing.join(", ")}. Use a new empty database or complete the migration before deployment; startup is stopped to protect existing records.`);
  }

  console.log("[Database bootstrap] Fresh database detected; applying the checked-in 91DAB migrations.");
  const result = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate"], { stdio: "inherit", env: process.env });
  if (result.status !== 0) fail("Schema migration failed. Review the Render deploy logs before retrying.");

  try {
    const remaining = await getMissingTables();
    if (remaining.length) fail(`Migration completed but tables are still missing: ${remaining.join(", ")}.`);
  } catch (error) {
    fail(`Could not verify the migrated database schema. ${error instanceof Error ? error.message : ""}`.trim());
  }
  console.log("[Database bootstrap] 91DAB schema is ready.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => fail(error instanceof Error ? error.message : "Unexpected database bootstrap failure"));
