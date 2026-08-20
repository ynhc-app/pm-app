// Load dotenv at the very top
require("dotenv").config();

const { PrismaClient } = require("./src/generated/prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");
const { createClient } = require("@libsql/client");

console.log("process.env.DATABASE_URL:", process.env.DATABASE_URL);

try {
  const libsql = createClient({ url: "file:prisma/dev.db" });
  const adapter = new PrismaLibSql(libsql);
  console.log("Adapter initialized successfully.");

  const prisma = new PrismaClient({
    adapter,
  });
  console.log("PrismaClient initialized successfully.");

  prisma.project.findFirst()
    .then((project) => {
      console.log("Query successful! Project:", project);
    })
    .catch((err) => {
      console.error("Query failed:", err);
    });
} catch (err) {
  console.error("Initialization failed with error:", err);
}
