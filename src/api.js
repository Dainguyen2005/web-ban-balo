export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error(
      "Không kết nối được máy chủ. Hãy chạy npm run dev và thử lại.",
    );
  }
  if (
    !(response.headers.get("content-type") || "").includes("application/json")
  )
    throw new Error(
      "API chưa chạy. Bản demo đầy đủ cần máy chủ local (npm run dev).",
    );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Yêu cầu thất bại.");
  return data;
}
export const send = (path, method, data = {}) =>
  api(path, { method, body: JSON.stringify(data) });
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
