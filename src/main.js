import './style.css';
import { products, money, normalizeCart, cartTotal, filterProducts } from './catalog.js';

const $ = (selector) => document.querySelector(selector);
function bag(color, id) {
  return `<svg viewBox="0 0 300 340" role="img" aria-label="Minh họa balo" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade-${id}" x1="0" x2="1" y2=".4"><stop stop-color="white" stop-opacity=".15"/><stop offset=".5" stop-color="white" stop-opacity="0"/><stop offset="1" stop-opacity=".18"/></linearGradient><filter id="shadow-${id}" x="-50%" y="-30%" width="200%" height="180%"><feDropShadow dx="3" dy="16" stdDeviation="11" flood-opacity=".18"/></filter></defs><ellipse cx="152" cy="312" rx="88" ry="10" fill="#222" opacity=".06"/><g filter="url(#shadow-${id})"><path d="M96 82 Q69 89 70 157 L67 269 Q60 282 51 266 L53 162 Q52 83 83 67Z M205 82 Q231 89 230 157 L233 269 Q240 282 249 266 L247 162 Q248 83 217 67Z" fill="${color}" stroke="#000" stroke-opacity=".17" stroke-width="6"/><path d="M128 59 V43 Q150 23 172 43 V59" fill="none" stroke="${color}" stroke-width="13"/><path d="M77 112 Q76 56 150 55 Q224 56 223 112 L234 278 Q234 301 210 305 H90 Q66 301 66 278Z" fill="${color}"/><path d="M77 112 Q76 56 150 55 Q224 56 223 112 L234 278 Q234 301 210 305 H90 Q66 301 66 278Z" fill="url(#shade-${id})"/><path d="M84 125 Q84 67 150 67 Q216 67 216 125" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="3"/><path d="M86 191 Q150 180 215 191 L218 266 Q216 281 201 283 H101 Q83 280 83 266Z" fill="${color}" stroke="#000" stroke-opacity=".16" stroke-width="2"/><path d="M88 203 Q150 194 211 203" fill="none" stroke="#333" stroke-opacity=".55" stroke-width="3"/><path d="M198 205 v16" stroke="#c8bda4" stroke-width="4" stroke-linecap="round"/><rect x="130" y="128" width="40" height="25" rx="2" fill="#e8dfcc"/><text x="150" y="145" text-anchor="middle" font-family="Georgia,serif" font-size="16" fill="#454b3d">mây</text><path d="M69 230 L57 233 V273 Q58 285 68 286 M232 230 L243 233 V273 Q242 285 232 286" fill="${color}" stroke="#000" stroke-opacity=".12" stroke-width="2"/></g></svg>`;
}

let cart = {};
try { cart = normalizeCart(JSON.parse(localStorage.getItem('may-cart') || '{}')); } catch { /* Storage may be unavailable or contain invalid JSON. */ }
let category = 'all';
let toastTimer;
$('#hero-bag').innerHTML = bag('#9ca486', 'hero');

function renderProducts() {
  const visible = filterProducts(category, $('#search').value);
  $('#products').innerHTML = visible.map(p => `<article class="product"><div class="product-art" style="background:${p.background}">${p.tag ? `<span class="tag">${p.tag}</span>` : ''}${bag(p.color, p.id)}<button class="add-button" data-add="${p.id}" type="button" aria-label="Thêm ${p.name} vào giỏ">+</button></div><div class="product-title"><h3>${p.name}</h3><span>${money(p.price)}</span></div><p>${p.description}</p><div class="swatches" aria-label="Màu minh họa">${p.colors.map(c => `<span style="background:${c}"></span>`).join('')}</div></article>`).join('');
  $('#empty-search').hidden = visible.length > 0;
}

function renderCart() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  $('#cart-count').textContent = count;
  $('#open-cart').setAttribute('aria-label', `Mở giỏ hàng, ${count} sản phẩm`);
  $('#cart-items').innerHTML = count ? products.filter(p => cart[p.id]).map(p => `<article class="cart-item"><div class="cart-bag" style="background:${p.background}">${bag(p.color, `cart-${p.id}`)}</div><div><h3>${p.name}</h3><p>${money(p.price)}</p><div class="quantity"><button data-change="${p.id}" data-delta="-1" type="button" aria-label="Giảm số lượng ${p.name}">−</button><span aria-label="Số lượng">${cart[p.id]}</span><button data-change="${p.id}" data-delta="1" type="button" aria-label="Tăng số lượng ${p.name}" ${cart[p.id] >= 99 ? 'disabled' : ''}>+</button><button class="remove" data-remove="${p.id}" type="button">Xóa</button></div></div></article>`).join('') : '<div class="empty-cart"><span>◇</span><h3>Hành trình đang chờ bạn</h3><p>Thêm một chiếc balo yêu thích vào giỏ nhé.</p><button class="button" id="continue-shopping" type="button">Khám phá balo →</button></div>';
  const total = cartTotal(cart);
  $('#cart-summary').innerHTML = count ? `<div class="total"><span>Tạm tính</span><strong>${money(total)}</strong></div><p class="shipping">${total >= 800000 ? 'Đơn hàng đủ điều kiện miễn phí giao hàng.' : `Thêm ${money(800000 - total)} để được miễn phí giao hàng.`}</p><p class="demo-note">Đây là giỏ hàng mẫu. Chưa hỗ trợ đặt hàng, thanh toán hoặc lưu thông tin khách hàng.</p>` : '';
}

function saveCart() {
  try { localStorage.setItem('may-cart', JSON.stringify(cart)); } catch { showToast('Trình duyệt không cho lưu giỏ hàng. Giỏ vẫn dùng được trong phiên này.'); }
  renderCart();
}
function showToast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800);
}
$('.filters').addEventListener('click', e => {
  const button = e.target.closest('[data-filter]');
  if (!button) return;
  category = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  renderProducts();
});
$('#search').addEventListener('input', renderProducts);
$('#products').addEventListener('click', e => {
  const button = e.target.closest('[data-add]');
  if (!button) return;
  const id = button.dataset.add;
  if ((cart[id] || 0) >= 99) return showToast('Tối đa 99 chiếc cho mỗi sản phẩm.');
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  showToast(`Đã thêm ${products.find(p => p.id === id).name} vào giỏ`);
});
const dialog = $('#cart-dialog');
$('#open-cart').addEventListener('click', () => dialog.showModal());
$('#close-cart').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {
  if (e.target === dialog && e.clientX < dialog.getBoundingClientRect().left) dialog.close();
  if (e.target.closest('#continue-shopping')) { dialog.close(); $('#san-pham').scrollIntoView({ behavior: 'smooth' }); }
  const change = e.target.closest('[data-change]');
  const remove = e.target.closest('[data-remove]');
  if (!change && !remove) return;
  if (remove) delete cart[remove.dataset.remove];
  if (change) {
    const id = change.dataset.change;
    cart[id] = Math.min(99, (cart[id] || 0) + Number(change.dataset.delta));
    if (cart[id] <= 0) delete cart[id];
  }
  saveCart();
});
renderProducts();
renderCart();
