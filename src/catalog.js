export let products = [
  {
    id: "classic",
    name: "Everyday Classic",
    category: "daily",
    description: "Balo hằng ngày · 18L",
    price: 490000,
    color: "#a7ad8f",
    background: "#eeeee5",
    tag: "BÁN CHẠY",
    colors: ["#a7ad8f", "#393c38", "#ccb99d"],
  },
  {
    id: "campus",
    name: "Campus Essential",
    category: "school",
    description: "Balo đi học · Laptop 15.6”",
    price: 590000,
    color: "#c5a680",
    background: "#f1e9dd",
    tag: "",
    colors: ["#c5a680", "#424e59", "#a8b2a0"],
  },
  {
    id: "roam",
    name: "Roam Weekend",
    category: "travel",
    description: "Balo du lịch · 28L",
    price: 790000,
    color: "#536958",
    background: "#e4e9e3",
    tag: "MỚI",
    colors: ["#536958", "#333b39", "#b9a38a"],
  },
  {
    id: "mini",
    name: "Mini Daypack",
    category: "daily",
    description: "Balo nhỏ gọn · 10L",
    price: 390000,
    color: "#c08f7e",
    background: "#f1e5df",
    tag: "",
    colors: ["#c08f7e", "#ded2ba", "#545b55"],
  },
];

export const money = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );

export function normalizeCart(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    products
      .filter(
        (p) =>
          Number.isInteger(value[p.id]) && value[p.id] > 0 && value[p.id] <= 99,
      )
      .map((p) => [p.id, value[p.id]]),
  );
}

export function cartTotal(cart) {
  return products.reduce((total, p) => total + p.price * (cart[p.id] || 0), 0);
}

export function filterProducts(category, search) {
  const query = search.trim().toLocaleLowerCase("vi");
  return products.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      `${p.name} ${p.description}`.toLocaleLowerCase("vi").includes(query),
  );
}

export function setProducts(list) {
  products = list;
}
