import bcrypt from "bcryptjs";

const password = process.argv[2];
const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

console.log(await bcrypt.hash(password, rounds));
