import { db } from "./src/lib/db";
async function main() {
  await db.project.updateMany({
    data: { name: 'Pembangunan Gedung TPA Nurul Hikmah' }
  });
  console.log('Done');
}
main();
