import express from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { openDatabase, hashPassword, verifyPassword } from "./db.js";

const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const text = (value, min, max, label) =>
  typeof value === "string" &&
  value.trim().length >= min &&
  value.trim().length <= max
    ? value.trim()
    : fail(400, `${label} cần từ ${min} đến ${max} ký tự.`);
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
export function createApp(dbPath) {
  const db = openDatabase(dbPath);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "20kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD"].includes(req.method)) {
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Yêu cầu phải là JSON." });
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
        return res
          .status(400)
          .json({ error: "Dữ liệu cần là một đối tượng JSON." });
      if (req.get("origin")) {
        try {
          const origin = new URL(req.get("origin"));
          const localDevOrigins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
          ];
          if (
            origin.origin !== `http://${req.get("host")}` &&
            !localDevOrigins.includes(origin.origin)
          )
            return res
              .status(403)
              .json({ error: "Nguồn yêu cầu không hợp lệ." });
        } catch {
          return res.status(403).json({ error: "Nguồn yêu cầu không hợp lệ." });
        }
      }
    }
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("may_session="))
      ?.slice(12);
    if (token)
      req.user = db
        .prepare(
          "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?",
        )
        .get(tokenHash(token), Date.now());
    next();
  });
  const auth = (req, res, next) =>
    req.user ? next() : res.status(401).json({ error: "Bạn cần đăng nhập." });
  const admin = (req, res, next) =>
    req.user?.role === "admin"
      ? next()
      : res
          .status(403)
          .json({ error: "Chỉ quản trị viên được thực hiện thao tác này." });
  function session(user, res) {
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      tokenHash(token),
      user.id,
      Date.now() + 86400000,
    );
    res.cookie("may_session", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 86400000,
      path: "/",
    });
    return { user: publicUser(user) };
  }
  // A small in-memory limiter is sufficient for a single-process local demo.
  const attempts = new Map();
  function loginLimit(req, res, next) {
    const key = req.ip;
    const row = attempts.get(key);
    if (row && row.until > Date.now() && row.count >= 30)
      return res.status(429).json({ error: "Thử lại sau 10 phút." });
    if (!row || row.until <= Date.now())
      attempts.set(key, { count: 1, until: Date.now() + 600000 });
    else row.count++;
    next();
  }
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: req.user ? publicUser(req.user) : null }),
  );
  app.post("/api/auth/register", loginLimit, (req, res) => {
    const name = text(req.body.name, 2, 80, "Họ tên");
    const email = text(req.body.email, 3, 120, "Email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "Email không hợp lệ.");
    const password = text(req.body.password, 8, 128, "Mật khẩu");
    if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
      fail(409, "Email đã được đăng ký.");
    const result = db
      .prepare("INSERT INTO users (name,email,password_hash) VALUES (?,?,?)")
      .run(name, email, hashPassword(password));
    res
      .status(201)
      .json(
        session(
          db
            .prepare("SELECT * FROM users WHERE id=?")
            .get(result.lastInsertRowid),
          res,
        ),
      );
  });
  app.post("/api/auth/login", loginLimit, (req, res) => {
    const email = text(req.body.email, 3, 120, "Email").toLowerCase();
    const password = text(req.body.password, 1, 128, "Mật khẩu");
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    if (!user || !verifyPassword(password, user.password_hash))
      fail(401, "Email hoặc mật khẩu chưa đúng.");
    res.json(session(user, res));
  });
  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("may_session="))
      ?.slice(12);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token=?").run(tokenHash(token));
    res.clearCookie("may_session", { path: "/" }).json({ ok: true });
  });
  function product(p) {
    return { ...p, colors: [p.color] };
  }
  app.get("/api/products", (req, res) =>
    res.json({
      products: db
        .prepare("SELECT * FROM products WHERE active=1 ORDER BY rowid")
        .all()
        .map(product),
    }),
  );
  app.get("/api/products/:id", (req, res) => {
    const p = db
      .prepare("SELECT * FROM products WHERE id=? AND active=1")
      .get(req.params.id);
    if (!p) fail(404, "Không tìm thấy sản phẩm.");
    res.json({ product: product(p) });
  });
  function readProduct(body) {
    const p = {};
    for (const [key, min, max, label] of [
      ["name", 2, 80, "Tên sản phẩm"],
      ["description", 5, 500, "Mô tả"],
    ])
      p[key] = text(body[key], min, max, label);
    if (!["daily", "school", "travel"].includes(body.category))
      fail(400, "Danh mục không hợp lệ.");
    p.category = body.category;
    if (
      !Number.isInteger(body.price) ||
      body.price < 1000 ||
      body.price > 100000000
    )
      fail(400, "Giá phải từ 1.000 đến 100.000.000đ.");
    if (!Number.isInteger(body.stock) || body.stock < 0 || body.stock > 10000)
      fail(400, "Tồn kho phải từ 0 đến 10.000.");
    p.price = body.price;
    p.stock = body.stock;
    for (const key of ["color", "background"]) {
      if (typeof body[key] !== "string" || !/^#[a-f\d]{6}$/i.test(body[key]))
        fail(400, "Màu phải ở dạng #rrggbb.");
      p[key] = body[key];
    }
    p.tag = body.tag ? text(body.tag, 0, 20, "Nhãn") : "";
    return p;
  }
  app.get("/api/admin/products", auth, admin, (req, res) =>
    res.json({
      products: db
        .prepare("SELECT * FROM products ORDER BY rowid DESC")
        .all()
        .map(product),
    }),
  );
  app.post("/api/admin/products", auth, admin, (req, res) => {
    const p = readProduct(req.body),
      id = randomUUID();
    db.prepare(
      "INSERT INTO products (id,name,category,description,price,color,background,tag,stock) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      p.name,
      p.category,
      p.description,
      p.price,
      p.color,
      p.background,
      p.tag,
      p.stock,
    );
    res
      .status(201)
      .json({
        product: product(
          db.prepare("SELECT * FROM products WHERE id=?").get(id),
        ),
      });
  });
  app.put("/api/admin/products/:id", auth, admin, (req, res) => {
    const p = readProduct(req.body);
    const result = db
      .prepare(
        "UPDATE products SET name=?,category=?,description=?,price=?,color=?,background=?,tag=?,stock=? WHERE id=? AND active=1",
      )
      .run(
        p.name,
        p.category,
        p.description,
        p.price,
        p.color,
        p.background,
        p.tag,
        p.stock,
        req.params.id,
      );
    if (!result.changes) fail(404, "Không tìm thấy sản phẩm đang bán.");
    res.json({ ok: true });
  });
  app.delete("/api/admin/products/:id", auth, admin, (req, res) => {
    if (
      !db
        .prepare("UPDATE products SET active=0 WHERE id=? AND active=1")
        .run(req.params.id).changes
    )
      fail(404, "Không tìm thấy sản phẩm.");
    res.json({ ok: true });
  });
  const orderView = (o) => ({
    ...o,
    items: db
      .prepare(
        "SELECT product_id,name,price,quantity FROM order_items WHERE order_id=?",
      )
      .all(o.id),
  });
  app.get("/api/orders", auth, (req, res) =>
    res.json({
      orders: db
        .prepare(
          "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC",
        )
        .all(req.user.id)
        .map(orderView),
    }),
  );
  app.post("/api/orders", auth, (req, res) => {
    const recipient = text(req.body.recipient, 2, 80, "Người nhận");
    const phone = text(req.body.phone, 10, 11, "Số điện thoại");
    if (!/^0\d{9,10}$/.test(phone))
      fail(400, "Số điện thoại cần bắt đầu bằng 0 và có 10–11 số.");
    const address = text(req.body.address, 10, 300, "Địa chỉ");
    if (!["cod", "demo_card"].includes(req.body.payment))
      fail(400, "Phương thức thanh toán không hợp lệ.");
    const key = text(req.body.requestKey, 16, 80, "Mã yêu cầu");
    const existing = db
      .prepare("SELECT * FROM orders WHERE user_id=? AND request_key=?")
      .get(req.user.id, key);
    if (existing) return res.json({ order: orderView(existing) });
    const items = req.body.items;
    if (!Array.isArray(items) || !items.length || items.length > 50)
      fail(400, "Giỏ hàng cần có 1–50 dòng sản phẩm.");
    if (new Set(items.map((i) => i?.productId)).size !== items.length)
      fail(400, "Sản phẩm trong giỏ bị trùng.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const lines = items.map((i) => {
        if (
          !i ||
          typeof i.productId !== "string" ||
          !Number.isInteger(i.quantity) ||
          i.quantity < 1 ||
          i.quantity > 99
        )
          fail(400, "Số lượng không hợp lệ.");
        const p = db
          .prepare("SELECT * FROM products WHERE id=? AND active=1")
          .get(i.productId);
        if (!p)
          fail(409, "Một sản phẩm đã ngừng bán. Vui lòng làm mới giỏ hàng.");
        if (p.stock < i.quantity)
          fail(409, `${p.name} chỉ còn ${p.stock} chiếc.`);
        return { ...p, quantity: i.quantity };
      });
      const subtotal = lines.reduce((s, p) => s + p.price * p.quantity, 0),
        shipping = subtotal >= 800000 ? 0 : 30000;
      const id = randomUUID();
      db.prepare(
        "INSERT INTO orders (id,user_id,recipient,phone,address,payment,subtotal,shipping,total,created_at,request_key) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        req.user.id,
        recipient,
        phone,
        address,
        req.body.payment,
        subtotal,
        shipping,
        subtotal + shipping,
        new Date().toISOString(),
        key,
      );
      for (const p of lines) {
        db.prepare(
          "INSERT INTO order_items (order_id,product_id,name,price,quantity) VALUES (?,?,?,?,?)",
        ).run(id, p.id, p.name, p.price, p.quantity);
        db.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(
          p.quantity,
          p.id,
        );
      }
      db.exec("COMMIT");
      res
        .status(201)
        .json({
          order: orderView(
            db.prepare("SELECT * FROM orders WHERE id=?").get(id),
          ),
        });
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
  const nextStatus = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["shipped", "cancelled"],
    shipped: ["completed"],
    completed: [],
    cancelled: [],
  };
  app.patch("/api/orders/:id/status", auth, (req, res) => {
    const o = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
    if (!o || (req.user.role !== "admin" && o.user_id !== req.user.id))
      fail(404, "Không tìm thấy đơn hàng.");
    const status = req.body.status;
    if (
      req.user.role !== "admin" &&
      (o.status !== "pending" || status !== "cancelled")
    )
      fail(403, "Bạn chỉ có thể hủy đơn đang chờ xác nhận.");
    if (!nextStatus[o.status].includes(status))
      fail(409, "Không thể chuyển sang trạng thái này.");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, o.id);
      if (status === "cancelled")
        for (const line of db
          .prepare("SELECT * FROM order_items WHERE order_id=?")
          .all(o.id))
          db.prepare("UPDATE products SET stock=stock+? WHERE id=?").run(
            line.quantity,
            line.product_id,
          );
      db.exec("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
  app.get("/api/admin/orders", auth, admin, (req, res) =>
    res.json({
      orders: db
        .prepare("SELECT * FROM orders ORDER BY created_at DESC")
        .all()
        .map(orderView),
    }),
  );
  app.get("/api/admin/stats", auth, admin, (req, res) =>
    res.json({
      customers: db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE role='customer'")
        .get().count,
      products: db
        .prepare("SELECT COUNT(*) AS count FROM products WHERE active=1")
        .get().count,
      orders: db.prepare("SELECT COUNT(*) AS count FROM orders").get().count,
      revenue: db
        .prepare(
          "SELECT COALESCE(SUM(total),0) AS total FROM orders WHERE status='completed'",
        )
        .get().total,
    }),
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API không tồn tại." }),
  );
  app.use((err, req, res, next) => {
    if (!err.status) console.error(err);
    res
      .status(err.status || 500)
      .json({
        error:
          err.status === 400 && err.type === "entity.parse.failed"
            ? "JSON không hợp lệ."
            : err.status
              ? err.message
              : "Có lỗi máy chủ. Vui lòng thử lại.",
      });
  });
  return { app, db };
}
