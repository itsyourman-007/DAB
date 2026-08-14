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
  merchantQuoteClientCustomizations: `CREATE TABLE IF NOT EXISTS \`merchantQuoteClientCustomizations\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`clientName\` varchar(160) NOT NULL,
    \`clientEmail\` varchar(320),
    \`clientPhone\` varchar(64),
    \`unitsPurchased\` int NOT NULL,
    \`revenueInr\` int NOT NULL,
    \`notes\` varchar(1000),
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`merchantQuoteClientCustomizations_id\` PRIMARY KEY(\`id\`)
  )`,
  merchantClinicQuoteLeads: `CREATE TABLE IF NOT EXISTS \`merchantClinicQuoteLeads\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`clientEmail\` varchar(320) NOT NULL,
    \`clientPhone\` varchar(64),
    \`note\` varchar(1000) NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`merchantClinicQuoteLeads_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`merchantClinicQuoteLeads_clientEmail_unique\` UNIQUE(\`clientEmail\`)
  )`,
};

const ADDITIVE_COLUMNS = {
  "merchantOrders.deliveryStartMonth": "ALTER TABLE `merchantOrders` ADD COLUMN `deliveryStartMonth` varchar(7)",
};

const REQUIRED_TABLES = [...BASE_TABLES, ...Object.keys(ADDITIVE_TABLES)];

function fail(message) {
  console.error(`[Database bootstrap] ${message}`);
  process.exit(1);
}

async function getMissingSchema() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) fail("DATABASE_URL is required. Add a MySQL-compatible database URL in Render before deploying.");

  const connection = await mysql.createConnection(url);
  try {
    const [rows] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    const available = new Set(rows.map((row) => row.table_name));
    const missingTables = REQUIRED_TABLES.filter((table) => !available.has(table));
    const missingColumns = [];
    if (available.has("merchantOrders")) {
      const [columns] = await connection.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'merchantOrders'"
      );
      const existingColumns = new Set(columns.map((column) => column.column_name));
      if (!existingColumns.has("deliveryStartMonth")) missingColumns.push("merchantOrders.deliveryStartMonth");
    }
    return { missingTables, missingColumns };
  } finally {
    await connection.end();
  }
}

async function main() {
  let schema;
  try {
    schema = await getMissingSchema();
  } catch (error) {
    fail(`Could not reach the configured database. Check DATABASE_URL, TiDB public access, and TLS. ${error instanceof Error ? error.message : ""}`.trim());
  }

  const { missingTables, missingColumns } = schema;
  if (missingTables.length === 0 && missingColumns.length === 0) {
    console.log("[Database bootstrap] Existing 91DAB schema detected; migrations already applied.");
    return;
  }

  const missingBaseTables = missingTables.filter((table) => BASE_TABLES.includes(table));
  const missingAdditiveTables = missingTables.filter((table) => table in ADDITIVE_TABLES);
  if (missingBaseTables.length === 0 && missingAdditiveTables.length === missingTables.length) {
    console.log(`[Database bootstrap] Applying additive schema updates: ${[...missingAdditiveTables, ...missingColumns].join(", ")}.`);
    const url = process.env.DATABASE_URL.trim();
    const connection = await mysql.createConnection(url);
    try {
      for (const table of missingAdditiveTables) await connection.query(ADDITIVE_TABLES[table]);
      for (const column of missingColumns) await connection.query(ADDITIVE_COLUMNS[column]);
    } finally {
      await connection.end();
    }
    const remaining = await getMissingSchema();
    if (remaining.missingTables.length || remaining.missingColumns.length) fail(`Additive schema update completed but schema entries are still missing: ${[...remaining.missingTables, ...remaining.missingColumns].join(", ")}.`);
    console.log("[Database bootstrap] Additive 91DAB schema updates are ready.");
    return;
  }

  if (missingTables.length !== REQUIRED_TABLES.length) {
    fail(`Database schema is incomplete. Missing entries: ${[...missingTables, ...missingColumns].join(", ")}. Use a new empty database or complete the migration before deployment; startup is stopped to protect existing records.`);
  }

  console.log("[Database bootstrap] Fresh database detected; applying the checked-in 91DAB migrations.");
  const result = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate"], { stdio: "inherit", env: process.env });
  if (result.status !== 0) fail("Schema migration failed. Review the Render deploy logs before retrying.");

  try {
    const remaining = await getMissingSchema();
    if (remaining.missingTables.length || remaining.missingColumns.length) fail(`Migration completed but schema entries are still missing: ${[...remaining.missingTables, ...remaining.missingColumns].join(", ")}.`);
  } catch (error) {
    fail(`Could not verify the migrated database schema. ${error instanceof Error ? error.message : ""}`.trim());
  }
  console.log("[Database bootstrap] 91DAB schema is ready.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => fail(error instanceof Error ? error.message : "Unexpected database bootstrap failure"));
