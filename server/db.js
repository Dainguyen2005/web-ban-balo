import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { products } from "../src/catalog.js";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password, hash) {
  const [salt, expected] = hash.split(":");
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    scryptSync(password, salt, 64),
  );
}
export function openDatabase(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer');
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL CHECK(price > 0), color TEXT NOT NULL, background TEXT NOT NULL, tag TEXT NOT NULL DEFAULT '', stock INTEGER NOT NULL CHECK(stock >= 0), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), recipient TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, payment TEXT NOT NULL, subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL, total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, request_key TEXT NOT NULL, UNIQUE(user_id, request_key));
    CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0));
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  if (!db.prepare("SELECT 1 FROM metadata WHERE key = 'seeded'").get()) {
    db.exec("BEGIN");
    try {
      const insert = db.prepare(
        "INSERT INTO products (id,name,category,description,price,color,background,tag,stock) VALUES (?,?,?,?,?,?,?,?,?)",
      );
      for (const p of products)
        insert.run(
          p.id,
          p.name,
          p.category,
          p.description,
          p.price,
          p.color,
          p.background,
          p.tag,
          20,
        );
      const user = db.prepare(
        "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
      );
      user.run(
        "Quản trị demo",
        "admin@may.local",
        hashPassword("Admin123!"),
        "admin",
      );
      user.run(
        "Khách hàng demo",
        "demo@may.local",
        hashPassword("Demo123!"),
        "customer",
      );
      db.prepare("INSERT INTO metadata VALUES (?,?)").run("seeded", "1");
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return db;
}
