import { api, send, escapeHTML as e } from "./api.js";
import { money, products } from "./catalog.js";
const statuses = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipped: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};
const transitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};
const $ = (s) => document.querySelector(s);
const field = (label, name, value = "", type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${e(value)}" ${extra} required></label>`;
export function initFeatures({
  getCart,
  clearCart,
  refreshProducts,
  showToast,
  bag,
}) {
  let user = null,
    authMode = "login",
    checkoutKey = "",
    adminProducts = [];
  const modal = $("#feature-dialog"),
    body = $("#feature-body");
  function open(title, html, wide = false) {
    $("#feature-title").textContent = title;
    modal.classList.toggle("wide", wide);
    body.innerHTML = `<p id="feature-error" class="form-error" role="alert" hidden></p>${html}`;
    if (!modal.open) modal.showModal();
    body.querySelector("input,button,select")?.focus();
  }
  function showError(err) {
    const el = $("#feature-error");
    el.hidden = false;
    el.textContent = err.message;
  }
  function accountNav() {
    $("#account-button").textContent = user ? user.name : "Đăng nhập";
    $("#orders-button").hidden = !user;
    $("#admin-button").hidden = user?.role !== "admin";
  }
  async function init() {
    try {
      ({ user } = await api("/auth/me"));
      accountNav();
    } catch (err) {
      showToast(err.message);
    }
  }
  function account(mode = "login") {
    authMode = mode;
    if (user)
      return open(
        "Tài khoản",
        `<p>Xin chào, <strong>${e(user.name)}</strong></p><p>${e(user.email)} · ${user.role === "admin" ? "Quản trị viên" : "Khách hàng"}</p><button class="button" data-action="logout">Đăng xuất</button>`,
      );
    open(
      mode === "register" ? "Tạo tài khoản" : "Chào bạn, mừng trở lại!",
      `<form id="auth-form" class="stack-form">${mode === "register" ? field("Họ tên", "name", "", "text", 'minlength="2" maxlength="80" autocomplete="name"') : ""}${field("Email", "email", "", "email", 'maxlength="120" autocomplete="username"')}${field("Mật khẩu", "password", "", "password", `minlength="${mode === "register" ? 8 : 1}" maxlength="128" autocomplete="${mode === "register" ? "new-password" : "current-password"}"`)}<button class="button">${mode === "register" ? "Đăng ký" : "Đăng nhập"}</button></form><button class="text-button" data-action="${mode === "register" ? "login" : "register"}">${mode === "register" ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}</button><details class="demo-accounts"><summary>Tài khoản dùng thử</summary><p>Khách: demo@may.local / Demo123!</p><p>Admin: admin@may.local / Admin123!</p><p>Chỉ dùng dữ liệu giả khi trải nghiệm demo.</p></details>`,
    );
  }
  function checkout() {
    $("#cart-dialog").close();
    if (!user) {
      account();
      showToast("Đăng nhập rồi mở giỏ hàng để tiếp tục đặt hàng.");
      return;
    }
    const cart = getCart();
    if (!Object.keys(cart).length) return showToast("Giỏ hàng đang trống.");
    checkoutKey = crypto.randomUUID();
    const subtotal = products.reduce(
        (s, p) => s + p.price * (cart[p.id] || 0),
        0,
      ),
      shipping = subtotal >= 800000 ? 0 : 30000;
    open(
      "Đặt hàng demo",
      `<p class="demo-note">Mô phỏng mua hàng, không thu tiền và không giao hàng thật. Hãy nhập thông tin giả.</p><ul class="checkout-lines">${products
        .filter((p) => cart[p.id])
        .map(
          (p) =>
            `<li><span>${e(p.name)} × ${cart[p.id]}</span><strong>${money(p.price * cart[p.id])}</strong></li>`,
        )
        .join(
          "",
        )}</ul><form id="checkout-form" class="stack-form">${field("Người nhận", "recipient", user.name, "text", 'minlength="2" maxlength="80"')}${field("Số điện thoại giả lập", "phone", "0900000000", "tel", 'pattern="0[0-9]{9,10}" maxlength="11"')}<label>Địa chỉ demo<textarea name="address" minlength="10" maxlength="300" required>123 Đường Demo, Quận 1, TP. Hồ Chí Minh</textarea></label><label>Phương thức thanh toán<select name="payment"><option value="cod">Thanh toán khi nhận hàng (mô phỏng)</option><option value="demo_card">Thanh toán online giả lập — không thu tiền</option></select></label><div class="price-row"><span>Tiền sản phẩm</span><strong>${money(subtotal)}</strong></div><div class="price-row"><span>Phí giao hàng</span><strong>${money(shipping)}</strong></div><div class="total"><span>Tổng cộng</span><strong>${money(subtotal + shipping)}</strong></div><p class="muted">Máy chủ sẽ kiểm tra giá và tồn kho khi bạn xác nhận.</p><button class="button">Xác nhận đặt hàng demo</button></form>`,
    );
  }
  async function orders(admin = false) {
    const { orders } = await api(admin ? "/admin/orders" : "/orders");
    const html = orders.length
      ? orders
          .map(
            (o) =>
              `<article class="order-card"><div class="order-heading"><strong>Đơn #${e(o.id.slice(0, 8))}</strong><span class="status">${statuses[o.status]}</span></div><p class="muted">${new Date(o.created_at).toLocaleString("vi-VN")} · ${o.payment === "cod" ? "COD mô phỏng" : "Online giả lập"}</p><p>${e(o.recipient)} · ${e(o.phone)}<br>${e(o.address)}</p><ul>${o.items.map((i) => `<li>${e(i.name)} × ${i.quantity} — ${money(i.price * i.quantity)}</li>`).join("")}</ul><div class="price-row"><span>Phí giao hàng</span><span>${money(o.shipping)}</span></div><div class="price-row"><strong>Tổng cộng</strong><strong>${money(o.total)}</strong></div><div class="order-actions">${(admin ? transitions[o.status] : o.status === "pending" ? ["cancelled"] : []).map((status) => `<button class="secondary-button" data-order="${e(o.id)}" data-status="${status}" data-admin="${admin}">${status === "cancelled" ? "Hủy đơn" : statuses[status]}</button>`).join("")}</div></article>`,
          )
          .join("")
      : "<p>Bạn chưa có đơn hàng nào. Khám phá balo và đặt thử một đơn nhé.</p>";
    open(
      admin ? "Quản lý đơn hàng" : "Đơn hàng của tôi",
      `${admin ? '<button class="text-button" data-action="admin">← Tổng quan quản trị</button>' : ""}${html}`,
      true,
    );
  }
  async function admin() {
    const [stats, result] = await Promise.all([
      api("/admin/stats"),
      api("/admin/products"),
    ]);
    adminProducts = result.products;
    open(
      "Quản trị Mây",
      `<div class="stats-grid"><div><strong>${stats.products}</strong>Sản phẩm đang bán</div><div><strong>${stats.customers}</strong>Khách hàng</div><div><strong>${stats.orders}</strong>Đơn hàng</div><div><strong>${money(stats.revenue)}</strong>Doanh thu đơn hoàn thành</div></div><div class="admin-actions"><button class="button" data-action="new-product">+ Thêm sản phẩm</button><button class="secondary-button" data-action="admin-orders">Quản lý đơn hàng</button></div><div class="table-scroll"><table><thead><tr><th>Sản phẩm</th><th>Giá</th><th>Tồn kho</th><th>Thao tác</th></tr></thead><tbody>${adminProducts.map((p) => `<tr><td>${e(p.name)}${!p.active ? ' <span class="muted">(Ngừng bán)</span>' : ""}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${p.active ? `<button class="text-button" data-edit="${e(p.id)}">Sửa</button><button class="text-button danger" data-delete="${e(p.id)}">Ngừng bán</button>` : "—"}</td></tr>`).join("")}</tbody></table></div>`,
      true,
    );
  }
  function productForm(id) {
    const p = adminProducts.find((p) => p.id === id) || {
      name: "",
      description: "",
      category: "daily",
      price: 490000,
      stock: 20,
      color: "#a7ad8f",
      background: "#eeeee5",
      tag: "",
    };
    open(
      id ? "Sửa sản phẩm" : "Thêm sản phẩm",
      `<button class="text-button" data-action="admin">← Quản trị</button><form id="product-form" data-id="${e(id || "")}" class="stack-form">${field("Tên sản phẩm", "name", p.name, "text", 'minlength="2" maxlength="80"')}<label>Danh mục<select name="category">${[
        ["daily", "Hằng ngày"],
        ["school", "Đi học"],
        ["travel", "Du lịch"],
      ]
        .map(
          ([v, t]) =>
            `<option value="${v}" ${p.category === v ? "selected" : ""}>${t}</option>`,
        )
        .join(
          "",
        )}</select></label><label>Mô tả<textarea name="description" minlength="5" maxlength="500" required>${e(p.description)}</textarea></label><div class="form-grid">${field("Giá (VND)", "price", p.price, "number", 'min="1000" max="100000000" step="1"')}${field("Tồn kho", "stock", p.stock, "number", 'min="0" max="10000" step="1"')}${field("Màu balo", "color", p.color, "color")}${field("Màu nền", "background", p.background, "color")}</div><label>Nhãn (tùy chọn)<input name="tag" maxlength="20" value="${e(p.tag)}"></label><button class="button">Lưu sản phẩm</button></form>`,
    );
  }
  async function detail(id) {
    const { product: p } = await api(`/products/${id}`);
    open(
      p.name,
      `<div class="detail-art" style="background:${e(p.background)}">${bag(p.color, `detail-${p.id}`)}</div><h3>${money(p.price)}</h3><p>${e(p.description)}</p><p>Còn ${p.stock} chiếc · Đổi trả 7 ngày · Phí giao hàng 30.000đ, miễn phí từ 800.000đ (chính sách demo).</p><button class="button" data-detail-add="${e(p.id)}" ${p.stock === 0 ? "disabled" : ""}>${p.stock ? "Thêm vào giỏ" : "Hết hàng"}</button>`,
    );
  }
  $("#account-button").addEventListener("click", () => account());
  $("#orders-button").addEventListener("click", () =>
    orders().catch(showToastError),
  );
  $("#admin-button").addEventListener("click", () =>
    admin().catch(showToastError),
  );
  $("#feature-close").addEventListener("click", () => modal.close());
  document.addEventListener("may:checkout", checkout);
  document.addEventListener("may:detail", (ev) =>
    detail(ev.detail).catch(showToastError),
  );
  const showToastError = (err) => showToast(err.message);
  body.addEventListener("click", async (ev) => {
    const target = ev.target.closest("button");
    if (!target) return;
    try {
      const action = target.dataset.action;
      if (action === "login" || action === "register") account(action);
      if (action === "logout") {
        await send("/auth/logout", "POST");
        user = null;
        accountNav();
        modal.close();
        showToast("Đã đăng xuất.");
      }
      if (action === "admin") await admin();
      if (action === "admin-orders") await orders(true);
      if (action === "orders") await orders();
      if (action === "new-product") productForm();
      if (target.dataset.edit) productForm(target.dataset.edit);
      if (
        target.dataset.delete &&
        confirm("Ngừng bán sản phẩm này? Đơn hàng cũ vẫn được giữ.")
      ) {
        await send(`/admin/products/${target.dataset.delete}`, "DELETE");
        await refreshProducts();
        await admin();
      }
      if (target.dataset.order) {
        if (
          target.dataset.status === "cancelled" &&
          !confirm("Xác nhận hủy đơn hàng?")
        )
          return;
        target.disabled = true;
        await send(`/orders/${target.dataset.order}/status`, "PATCH", {
          status: target.dataset.status,
        });
        await refreshProducts();
        await orders(target.dataset.admin === "true");
      }
      if (target.dataset.detailAdd) {
        document.dispatchEvent(
          new CustomEvent("may:add", { detail: target.dataset.detailAdd }),
        );
        modal.close();
      }
    } catch (err) {
      target.disabled = false;
      showError(err);
    }
  });
  body.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const button = form.querySelector('button[type="submit"],button.button');
    button.disabled = true;
    $("#feature-error").hidden = true;
    const data = Object.fromEntries(new FormData(form));
    try {
      if (form.id === "auth-form") {
        ({ user } = await send(`/auth/${authMode}`, "POST", data));
        accountNav();
        modal.close();
        showToast(`Xin chào ${user.name}!`);
      }
      if (form.id === "checkout-form") {
        const items = Object.entries(getCart()).map(
          ([productId, quantity]) => ({ productId, quantity }),
        );
        const { order } = await send("/orders", "POST", {
          ...data,
          items,
          requestKey: checkoutKey,
        });
        clearCart();
        open(
          "Đặt hàng thành công",
          `<div class="success-mark">✓</div><h3>Đã tạo đơn #${e(order.id.slice(0, 8))}</h3><p>Tổng cộng: <strong>${money(order.total)}</strong></p><p>Đơn demo đang chờ xác nhận. ${order.payment === "demo_card" ? "Thanh toán online được mô phỏng thành công, không thu tiền." : "Thanh toán khi nhận hàng được mô phỏng."}</p><button class="button" data-action="orders">Xem đơn hàng của tôi</button>`,
        );
        await refreshProducts();
      }
      if (form.id === "product-form") {
        data.price = Number(data.price);
        data.stock = Number(data.stock);
        const id = form.dataset.id;
        await send(
          id ? `/admin/products/${id}` : "/admin/products",
          id ? "PUT" : "POST",
          data,
        );
        await refreshProducts();
        await admin();
        showToast("Đã lưu sản phẩm.");
      }
    } catch (err) {
      showError(err);
    } finally {
      button.disabled = false;
    }
  });
  init();
}
