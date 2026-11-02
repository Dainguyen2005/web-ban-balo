# Mây — Website bán balo

Website mẫu đầu tiên với HTML, CSS và JavaScript, sử dụng Vite để phát triển và build.

## Bắt đầu

Cần Node.js 20.19+ hoặc 22.12+ (môi trường hiện tại dùng Node.js 24).

```bash
npm ci
npm run dev
```

## Kiểm tra và build

```bash
npm test
npm run build
npm run preview
```

## Tính năng

- Trang chủ và bộ sưu tập với minh họa balo SVG.
- Lọc theo nhu cầu và tìm kiếm tên sản phẩm.
- Thêm, tăng, giảm, xóa sản phẩm trong giỏ; tính tổng tiền và lưu giỏ trên trình duyệt.
- Giao diện thích ứng điện thoại, điều khiển bàn phím và thông báo thêm sản phẩm.

Đây là bản giao diện mẫu. Tên, giá, sản phẩm và chính sách chỉ để minh họa; chưa có máy chủ, tài khoản, đặt hàng hay thanh toán thực tế. Các chấm màu là minh họa bảng màu, chưa hỗ trợ chọn biến thể.

Sửa danh sách và giá trong `src/catalog.js`, giao diện trong `index.html` và `src/style.css`, tương tác trong `src/main.js`. Giỏ hàng được lưu cục bộ, không đồng bộ giữa các thiết bị.
