require('dotenv').config();
const Database = require('better-sqlite3');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('./src/generated/prisma/client');

const db = new Database('prisma/dev.db');
const adapter = new PrismaBetterSqlite3(db);
const prisma = new PrismaClient({ adapter });

prisma.project.findFirst()
  .then(p => { console.log('OK!', p); return prisma.$disconnect(); })
  .catch(e => { console.error('ERR:', e.message); });
