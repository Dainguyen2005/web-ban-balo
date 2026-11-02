import "./style.css";
import {
  products,
  money,
  normalizeCart,
  cartTotal,
  filterProducts,
  setProducts,
} from "./catalog.js";

import { bag } from "./bag.js";
import { api, escapeHTML as e } from "./api.js";
import { initFeatures } from "./features.js";

const $ = (selector) => document.querySelector(selector);

let cart = {};
try {
  cart = JSON.parse(localStorage.getItem("may-cart") || "{}");
} catch {
  /* Storage may be unavailable or contain invalid JSON. */
}
let category = "all";
let toastTimer;
$("#hero-bag").innerHTML = bag("#9ca486", "hero");

function renderProducts() {
  const visible = filterProducts(category, $("#search").value);
  if ($("#sort").value === "price-asc")
    visible.sort((a, b) => a.price - b.price);
  if ($("#sort").value === "price-desc")
    visible.sort((a, b) => b.price - a.price);
  $("#products").innerHTML = visible
    .map(
      (p) =>
        `<article class="product"><div class="product-art" style="background:${p.background}">${p.tag ? `<span class="tag">${e(p.tag)}</span>` : ""}${bag(p.color, p.id)}<button class="add-button" data-add="${p.id}" type="button" aria-label="Thêm ${e(p.name)} vào giỏ" ${p.stock === 0 ? "disabled" : ""}>+</button></div><div class="product-title"><h3><button class="product-link" data-detail="${p.id}" type="button">${e(p.name)}</button></h3><span>${money(p.price)}</span></div><p>${e(p.description)}</p><p class="stock-label">${p.stock ?? 20} chiếc còn lại</p><div class="swatches" aria-label="Màu minh họa">${p.colors.map((c) => `<span style="background:${c}"></span>`).join("")}</div></article>`,
    )
    .join("");
  $("#empty-search").hidden = visible.length > 0;
}

function renderCart() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  $("#cart-count").textContent = count;
  $("#open-cart").setAttribute("aria-label", `Mở giỏ hàng, ${count} sản phẩm`);
  $("#cart-items").innerHTML = count
    ? products
        .filter((p) => cart[p.id])
        .map(
          (p) =>
            `<article class="cart-item"><div class="cart-bag" style="background:${p.background}">${bag(p.color, `cart-${p.id}`)}</div><div><h3>${e(p.name)}</h3><p>${money(p.price)}</p><div class="quantity"><button data-change="${p.id}" data-delta="-1" type="button" aria-label="Giảm số lượng ${e(p.name)}">−</button><span aria-label="Số lượng">${cart[p.id]}</span><button data-change="${p.id}" data-delta="1" type="button" aria-label="Tăng số lượng ${e(p.name)}" ${cart[p.id] >= 99 ? "disabled" : ""}>+</button><button class="remove" data-remove="${p.id}" type="button">Xóa</button></div></div></article>`,
        )
        .join("")
    : '<div class="empty-cart"><span>◇</span><h3>Hành trình đang chờ bạn</h3><p>Thêm một chiếc balo yêu thích vào giỏ nhé.</p><button class="button" id="continue-shopping" type="button">Khám phá balo →</button></div>';
  const total = cartTotal(cart);
  $("#cart-summary").innerHTML = count
    ? `<div class="total"><span>Tạm tính</span><strong>${money(total)}</strong></div><p class="shipping">${total >= 800000 ? "Đơn hàng đủ điều kiện miễn phí giao hàng." : `Thêm ${money(800000 - total)} để được miễn phí giao hàng.`}</p><button class="button checkout-button" id="checkout-button" type="button">Tiến hành đặt hàng →</button><p class="demo-note">Đặt hàng demo, không thu tiền hoặc giao hàng thật.</p>`
    : "";
}

function saveCart() {
  try {
    localStorage.setItem("may-cart", JSON.stringify(cart));
  } catch {
    showToast(
      "Trình duyệt không cho lưu giỏ hàng. Giỏ vẫn dùng được trong phiên này.",
    );
  }
  renderCart();
}
function showToast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2800);
}
$(".filters").addEventListener("click", (e) => {
  const button = e.target.closest("[data-filter]");
  if (!button) return;
  category = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach((b) => {
    b.classList.toggle("active", b === button);
    b.setAttribute("aria-pressed", String(b === button));
  });
  renderProducts();
});
$("#search").addEventListener("input", renderProducts);
$("#sort").addEventListener("change", renderProducts);
function addProduct(id) {
  const p = products.find((p) => p.id === id);
  if (!p) return;
  if ((cart[id] || 0) >= Math.min(99, p.stock ?? 20))
    return showToast("Đã đạt số lượng tồn kho hoặc giới hạn 99 chiếc.");
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  showToast(`Đã thêm ${p.name} vào giỏ`);
}
$("#products").addEventListener("click", (ev) => {
  const detail = ev.target.closest("[data-detail]");
  if (detail)
    document.dispatchEvent(
      new CustomEvent("may:detail", { detail: detail.dataset.detail }),
    );
  const button = ev.target.closest("[data-add]");
  if (button) addProduct(button.dataset.add);
});
document.addEventListener("may:add", (ev) => addProduct(ev.detail));
const dialog = $("#cart-dialog");
$("#open-cart").addEventListener("click", () => dialog.showModal());
$("#close-cart").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => {
  if (e.target === dialog && e.clientX < dialog.getBoundingClientRect().left)
    dialog.close();
  if (e.target.closest("#checkout-button"))
    document.dispatchEvent(new Event("may:checkout"));
  if (e.target.closest("#continue-shopping")) {
    dialog.close();
    $("#san-pham").scrollIntoView({ behavior: "smooth" });
  }
  const change = e.target.closest("[data-change]");
  const remove = e.target.closest("[data-remove]");
  if (!change && !remove) return;
  if (remove) delete cart[remove.dataset.remove];
  if (change) {
    const id = change.dataset.change;
    cart[id] = Math.min(
      99,
      products.find((p) => p.id === id)?.stock ?? 99,
      (cart[id] || 0) + Number(change.dataset.delta),
    );
    if (cart[id] <= 0) delete cart[id];
  }
  saveCart();
});
async function refreshProducts() {
  const data = await api("/products");
  setProducts(data.products);
  cart = normalizeCart(cart);
  for (const p of products)
    if (cart[p.id]) {
      cart[p.id] = Math.min(cart[p.id], p.stock);
      if (!cart[p.id]) delete cart[p.id];
    }
  renderProducts();
  saveCart();
  $("#catalog-error").hidden = true;
}
initFeatures({
  getCart: () => ({ ...cart }),
  clearCart: () => {
    cart = {};
    saveCart();
  },
  refreshProducts,
  showToast,
  bag,
});
refreshProducts().catch((err) => {
  setProducts([]);
  renderProducts();
  renderCart();
  $("#empty-search").hidden = true;
  $("#catalog-error").hidden = false;
  $("#catalog-error").textContent = err.message;
});
