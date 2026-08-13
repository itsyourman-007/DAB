import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";

const BASE_TABLES = [
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

const ADDITIVE_TABLES = {
  merchantInventoryShipmentAllocations: `CREATE TABLE IF NOT EXISTS \`merchantInventoryShipmentAllocations\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`allocationKey\` varchar(192) NOT NULL,
    \`orderId\` varchar(128) NOT NULL,
    \`productKey\` varchar(64) NOT NULL DEFAULT 'dab',
    \`periodKey\` varchar(7),
    \`allocationKind\` varchar(32) NOT NULL,
    \`units\` int NOT NULL,
    \`shippedAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`merchantInventoryShipmentAllocations_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`merchantInventoryShipmentAllocations_allocationKey_unique\` UNIQUE(\`allocationKey\`)
  )`,
};

const REQUIRED_TABLES = [...BASE_TABLES, ...Object.keys(ADDITIVE_TABLES)];

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

  const missingBaseTables = missing.filter((table) => BASE_TABLES.includes(table));
  const missingAdditiveTables = missing.filter((table) => table in ADDITIVE_TABLES);
  if (missingBaseTables.length === 0 && missingAdditiveTables.length === missing.length) {
    console.log(`[Database bootstrap] Applying additive schema updates: ${missingAdditiveTables.join(", ")}.`);
    const url = process.env.DATABASE_URL.trim();
    const connection = await mysql.createConnection(url);
    try {
      for (const table of missingAdditiveTables) await connection.query(ADDITIVE_TABLES[table]);
    } finally {
      await connection.end();
    }
    const remaining = await getMissingTables();
    if (remaining.length) fail(`Additive schema update completed but tables are still missing: ${remaining.join(", ")}.`);
    console.log("[Database bootstrap] Additive 91DAB schema updates are ready.");
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
