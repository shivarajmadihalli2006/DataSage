
import bcrypt from "bcrypt";
import { prisma, disconnectPrisma } from "../db/prisma.js";
import { config } from "../config.js";

async function seedAdmin() {
  const name = config.ADMIN_NAME;
  const email = config.ADMIN_EMAIL?.toLowerCase();
  const password = config.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env"
    );
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    if (existingAdmin.role === "ADMIN") {
      console.log("An admin account already exists for this email.");
      return;
    }

    throw new Error(
      "This email already belongs to a USER account. Choose another admin email."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`ADMIN account created successfully for ${email}`);
}

seedAdmin()
  .catch((error) => {
    console.error("Admin creation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
