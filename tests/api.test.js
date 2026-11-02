import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";

test("local shop API integration", async (t) => {
  const { app, db } = createApp(":memory:");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(
    path,
    method = "GET",
    data,
    cookie = "",
    headers = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  let customer, admin, second, order;
  const orderData = {
    recipient: "Người nhận demo",
    phone: "0900000000",
    address: "123 Đường Demo, Quận 1",
    payment: "demo_card",
    requestKey: "request-key-first-order",
    items: [{ productId: "classic", quantity: 2 }],
    total: 1,
  };
  await t.test(
    "authentication required and admin operations protected",
    async () => {
      assert.equal((await request("/orders")).status, 401);
      assert.equal((await request("/admin/products")).status, 401);
      assert.equal(
        (
          await request("/auth/login", "POST", {
            email: "demo@may.local",
            password: "wrong",
          })
        ).status,
        401,
      );
      customer = (
        await request("/auth/login", "POST", {
          email: "demo@may.local",
          password: "Demo123!",
        })
      ).cookie;
      admin = (
        await request("/auth/login", "POST", {
          email: "admin@may.local",
          password: "Admin123!",
        })
      ).cookie;
      assert.ok(customer);
      assert.ok(admin);
      assert.equal(
        (await request("/admin/products", "GET", undefined, customer)).status,
        403,
      );
      assert.equal(
        (await request("/auth/me", "GET", undefined, customer)).body.user.role,
        "customer",
      );
      assert.equal(
        (await request("/auth/me", "GET", undefined, customer)).body.user
          .password_hash,
        undefined,
      );
    },
  );
  await t.test(
    "register validates input and ignores client-supplied admin role",
    async () => {
      assert.equal(
        (
          await request("/auth/register", "POST", {
            name: "User",
            email: "invalid",
            password: "Password123",
          })
        ).status,
        400,
      );
      const result = await request("/auth/register", "POST", {
        name: "User <script>",
        email: "second@may.local",
        password: "Password123",
        role: "admin",
      });
      assert.equal(result.status, 201);
      assert.equal(result.body.user.role, "customer");
      second = result.cookie;
      assert.equal(
        (
          await request("/auth/register", "POST", {
            name: "Other",
            email: "SECOND@may.local",
            password: "Password123",
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "rejects invalid bodies, foreign origins, quantities, and phone",
    async () => {
      assert.equal((await request("/auth/login", "POST", [])).status, 400);
      assert.equal(
        (
          await request("/orders", "POST", orderData, customer, {
            Origin: "https://foreign.invalid",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/auth/me", "GET", undefined, customer, {
            Origin: "http://localhost:5173",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            "/orders",
            "POST",
            { ...orderData, phone: "bad" },
            customer,
            { Origin: "http://localhost:5173" },
          )
        ).status,
        400,
      );
      for (const quantity of [0, -1, 1.5, "2", 100])
        assert.equal(
          (
            await request(
              "/orders",
              "POST",
              { ...orderData, items: [{ productId: "classic", quantity }] },
              customer,
            )
          ).status,
          400,
        );
      assert.equal(
        (
          await request(
            "/orders",
            "POST",
            { ...orderData, phone: "abc" },
            customer,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/orders",
            "POST",
            {
              ...orderData,
              items: [
                { productId: "classic", quantity: 1 },
                { productId: "classic", quantity: 1 },
              ],
            },
            customer,
          )
        ).status,
        400,
      );
    },
  );
  await t.test(
    "checkout uses server prices, applies shipping threshold, decrements stock",
    async () => {
      const r = await request("/orders", "POST", orderData, customer);
      assert.equal(r.status, 201);
      order = r.body.order;
      assert.equal(order.subtotal, 980000);
      assert.equal(order.shipping, 0);
      assert.equal(order.total, 980000);
      assert.equal((await request("/products/classic")).body.product.stock, 18);
      const cheap = await request(
        "/orders",
        "POST",
        {
          ...orderData,
          requestKey: "request-key-cheap-order",
          items: [{ productId: "mini", quantity: 1 }],
          payment: "cod",
        },
        customer,
      );
      assert.equal(cheap.body.order.total, 420000);
      assert.equal(cheap.body.order.shipping, 30000);
    },
  );
  await t.test(
    "repeated checkout and concurrent duplicate requests create one order",
    async () => {
      const repeats = await Promise.all([
        request("/orders", "POST", orderData, customer),
        request("/orders", "POST", orderData, customer),
      ]);
      for (const r of repeats) assert.equal(r.body.order.id, order.id);
      assert.equal((await request("/products/classic")).body.product.stock, 18);
      assert.equal(
        (await request("/orders", "GET", undefined, customer)).body.orders
          .length,
        2,
      );
    },
  );
  await t.test("failed checkout rolls back all lines and stock", async () => {
    const r = await request(
      "/orders",
      "POST",
      {
        ...orderData,
        requestKey: "request-key-overstock",
        items: [
          { productId: "classic", quantity: 1 },
          { productId: "mini", quantity: 99 },
        ],
      },
      customer,
    );
    assert.equal(r.status, 409);
    assert.equal((await request("/products/classic")).body.product.stock, 18);
    assert.equal(
      (await request("/orders", "GET", undefined, customer)).body.orders.length,
      2,
    );
  });
  await t.test("order ownership and role cannot be bypassed", async () => {
    assert.equal(
      (await request("/orders", "GET", undefined, second)).body.orders.length,
      0,
    );
    assert.equal(
      (
        await request(
          `/orders/${order.id}/status`,
          "PATCH",
          { status: "cancelled" },
          second,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          `/orders/${order.id}/status`,
          "PATCH",
          { status: "completed" },
          customer,
        )
      ).status,
      403,
    );
  });
  await t.test("cancelling an order returns stock exactly once", async () => {
    assert.equal(
      (
        await request(
          `/orders/${order.id}/status`,
          "PATCH",
          { status: "cancelled" },
          customer,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          `/orders/${order.id}/status`,
          "PATCH",
          { status: "cancelled" },
          customer,
        )
      ).status,
      403,
    );
    assert.equal((await request("/products/classic")).body.product.stock, 20);
    assert.equal(
      (
        await request(
          `/orders/${order.id}/status`,
          "PATCH",
          { status: "confirmed" },
          admin,
        )
      ).status,
      409,
    );
  });
  await t.test(
    "admin validates products, creates, edits and soft deletes",
    async () => {
      const p = {
        name: "Portfolio <b>demo</b>",
        category: "daily",
        description: "Mô tả sản phẩm demo",
        price: 100000,
        stock: 2,
        color: "#aabbcc",
        background: "#ddeeff",
        tag: "MỚI",
      };
      assert.equal(
        (await request("/admin/products", "POST", { ...p, price: -1 }, admin))
          .status,
        400,
      );
      assert.equal(
        (
          await request(
            "/admin/products",
            "POST",
            { ...p, color: "url(evil)" },
            admin,
          )
        ).status,
        400,
      );
      const r = await request("/admin/products", "POST", p, admin);
      assert.equal(r.status, 201);
      const id = r.body.product.id;
      assert.equal(
        (
          await request(
            `/admin/products/${id}`,
            "PUT",
            { ...p, price: 150000 },
            admin,
          )
        ).status,
        200,
      );
      const purchase = await request(
        "/orders",
        "POST",
        {
          ...orderData,
          requestKey: "request-key-custom-product",
          items: [{ productId: id, quantity: 1 }],
        },
        customer,
      );
      assert.equal(purchase.body.order.items[0].price, 150000);
      await request(`/admin/products/${id}`, "DELETE", {}, admin);
      assert.equal((await request(`/products/${id}`)).status, 404);
      const old = (
        await request("/orders", "GET", undefined, customer)
      ).body.orders.find((o) => o.id === purchase.body.order.id);
      assert.equal(old.items[0].name, p.name);
      assert.equal(old.items[0].price, 150000);
    },
  );
  await t.test(
    "only valid admin status transitions update completed revenue",
    async () => {
      const orders = (await request("/admin/orders", "GET", undefined, admin))
        .body.orders;
      const o = orders.find((o) => o.status === "pending");
      assert.equal(
        (
          await request(
            `/orders/${o.id}/status`,
            "PATCH",
            { status: "completed" },
            admin,
          )
        ).status,
        409,
      );
      for (const status of ["confirmed", "shipped", "completed"])
        assert.equal(
          (await request(`/orders/${o.id}/status`, "PATCH", { status }, admin))
            .status,
          200,
        );
      assert.equal(
        (await request("/admin/stats", "GET", undefined, admin)).body.revenue,
        o.total,
      );
    },
  );
  await t.test(
    "logout and session expiry invalidate authentication",
    async () => {
      await request("/auth/logout", "POST", {}, second);
      assert.equal(
        (await request("/orders", "GET", undefined, second)).status,
        401,
      );
      db.prepare("UPDATE sessions SET expires_at=0").run();
      assert.equal(
        (await request("/orders", "GET", undefined, customer)).status,
        401,
      );
    },
  );
});

test("SQLite persists seeded data and changes across restarts without reseeding", () => {
  const dir = mkdtempSync(join(tmpdir(), "may-db-")),
    path = join(dir, "test.sqlite");
  try {
    const first = createApp(path);
    first.db.prepare("UPDATE products SET stock=7 WHERE id=?").run("classic");
    first.db.close();
    const second = createApp(path);
    assert.equal(
      second.db.prepare("SELECT stock FROM products WHERE id=?").get("classic")
        .stock,
      7,
    );
    assert.equal(
      second.db.prepare("SELECT count(*) AS n FROM users").get().n,
      2,
    );
    second.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
