import bcrypt from "bcrypt";
import dotenv from "dotenv";
import pool from "./src/config/db.js";

dotenv.config();

const args = process.argv.slice(2);
const getArg = (key) => {
  const index = args.indexOf(`--${key}`);
  if (index === -1) return null;
  return args[index + 1] || null;
};

const name = getArg("name") || process.env.ADMIN_NAME;
const email = getArg("email") || process.env.ADMIN_EMAIL;
const password = getArg("password") || process.env.ADMIN_PASSWORD;

if (!name || !email || !password) {
  console.error("Usage: node create-admin.js --name \"Name\" --email admin@example.com --password secret");
  process.exit(1);
}

const run = async () => {
  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      console.error("Admin with this email already exists.");
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (name, email, password, role, must_change_password)
       VALUES ($1, $2, $3, 'admin', true)`,
      [name, email, hashedPassword]
    );

    console.log("Admin user created successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to create admin:", error);
    process.exit(1);
  }
};

run();
