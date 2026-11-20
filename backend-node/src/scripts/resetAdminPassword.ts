
import bcrypt from "bcrypt";
import { prisma, disconnectPrisma } from "../db/prisma.js";
import { config } from "../config.js";

async function resetAdminPassword() {
  const email = config.ADMIN_EMAIL?.toLowerCase();
  const password = config.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }

  const admin = await prisma.user.findUnique({
    where: { email },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("ADMIN account not found for the configured email.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash },
  });

  console.log("ADMIN password updated successfully.");
}

resetAdminPassword()
  .catch((error) => {
    console.error("Password reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
