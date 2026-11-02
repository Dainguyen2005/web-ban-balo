# Mây — Demo website bán balo full stack

Dự án portfolio để thực hành và trình bày khi xin thực tập. Chạy trên máy cá nhân, không cần tên miền, hosting, API key hay cài MySQL. Giao diện tiếng Việt, tự thích ứng điện thoại/máy tính, hình balo SVG nằm sẵn trong mã nguồn.

## 1. Chạy trên máy của bạn

Cài **Node.js 24 LTS** từ https://nodejs.org (đã bao gồm npm). Mở terminal trong thư mục dự án:

```bash
npm ci
npm run dev
```

Mở **http://localhost:5173**. Lệnh này chạy cả Vite và API; giữ terminal mở. Dừng bằng `Ctrl+C`.

Nếu lấy dự án từ GitHub:

```bash
git clone https://github.com/Dainguyen2005/web-ban-balo.git
cd web-ban-balo
npm ci
npm run dev
```

Các thay đổi full stack cần có trong bản code bạn tải. Nếu đang dùng bản ZIP do Codex cung cấp, giải nén ZIP và mở terminal tại thư mục có `package.json`.

### Tài khoản dùng thử (chỉ dành cho demo local)

| Vai trò       | Email             | Mật khẩu    |
| ------------- | ----------------- | ----------- |
| Khách hàng    | `demo@may.local`  | `Demo123!`  |
| Quản trị viên | `admin@may.local` | `Admin123!` |

Hoặc tự đăng ký khách hàng mới từ nút **Đăng nhập → Đăng ký**. Dùng thông tin giả khi đặt hàng. Những tài khoản có mật khẩu công khai này chỉ phục vụ demo local.

## 2. Chức năng

- Xem danh mục, chi tiết, tồn kho; tìm kiếm, lọc theo nhu cầu, sắp xếp giá.
- Giỏ hàng lưu trong trình duyệt: thêm/xóa/tăng/giảm số lượng.
- Đăng ký, đăng nhập, đăng xuất; phiên lưu bằng cookie HttpOnly, SameSite Strict, hết hạn sau 24 giờ.
- Đặt hàng có địa chỉ, phí giao hàng; COD hoặc thanh toán online **giả lập**, không nhập thẻ và không thu tiền thật.
- Máy chủ tính tiền, kiểm tra và trừ tồn kho bằng transaction; mã yêu cầu chống tạo đơn trùng khi gửi lại.
- Lịch sử đơn theo tài khoản; khách hủy đơn đang chờ và hệ thống hoàn kho.
- Quản trị: tổng quan, thêm/sửa/ngừng bán sản phẩm, quản lý tồn kho, xem và cập nhật đơn.
- Trạng thái đơn: chờ xác nhận → đã xác nhận → đang giao → hoàn thành. Admin có thể hủy trước khi giao. Doanh thu chỉ tính đơn hoàn thành.
- Dữ liệu SQLite tồn tại sau khi khởi động lại; sản phẩm ngừng bán vẫn có trong lịch sử đơn cũ.

Mỗi sản phẩm có một màu minh họa; chưa có biến thể SKU theo màu. Chưa triển khai email, quên mật khẩu, vận chuyển hoặc thanh toán thật. Giỏ hàng nằm ở trình duyệt, không đồng bộ theo tài khoản/thiết bị. Đây là ứng dụng học tập chạy local, chưa được đánh giá để dùng trong kinh doanh thực tế.

## 3. Kịch bản trình bày 5 phút

1. Mở trang chủ, tìm balo, lọc theo danh mục, đổi thứ tự giá và xem chi tiết.
2. Đăng ký hoặc đăng nhập tài khoản khách; thêm 2 sản phẩm vào giỏ, thử đổi số lượng.
3. Đặt đơn với thông tin giả và chọn thanh toán online giả lập; kiểm tra mã đơn và tổng tiền.
4. Vào **Đơn hàng**: xem đơn, thử hủy một đơn chờ; kiểm tra tồn kho được hoàn lại.
5. Đăng xuất, đăng nhập admin; vào **Quản trị** để tạo/sửa/ngừng bán sản phẩm.
6. Tạo thêm một đơn khách, dùng admin chuyển trạng thái đến hoàn thành; kiểm tra doanh thu.
7. Khởi động lại ứng dụng để chứng minh dữ liệu vẫn còn. Giới thiệu transaction, phân quyền và kiểm thử bên dưới.

## 4. Kiến trúc

```text
Trình duyệt (HTML/CSS/JavaScript)
       │ fetch /api + session cookie
       ▼
Node.js 24 + Express 5
       │ prepared statements + transaction
       ▼
SQLite (data/may.sqlite)
```

- `src/main.js`: danh sách, giỏ hàng, tìm kiếm/lọc/sắp xếp.
- `src/features.js`: tài khoản, checkout, lịch sử, giao diện quản trị.
- `src/api.js`: gọi API và escape dữ liệu trước khi đưa vào HTML.
- `src/bag.js`, `src/style.css`: minh họa và giao diện.
- `server/app.js`: API, validation, session, phân quyền, nghiệp vụ đặt hàng.
- `server/db.js`: schema, dữ liệu khởi tạo, hash mật khẩu với scrypt + salt ngẫu nhiên.
- `server/index.js`: khởi động API và phục vụ bản build.
- `scripts/dev.js`: chạy frontend/backend cùng một lệnh.
- `tests/`: kiểm thử unit và integration, dùng database tạm tách biệt.

Bảng dữ liệu: `users`, `sessions`, `products`, `orders`, `order_items`, `metadata`. Giá/tên sản phẩm được chụp lại trong `order_items` khi đặt hàng, nên thay đổi danh mục không thay đổi lịch sử. Session token lưu dưới dạng hash trong DB. Server không tin tổng tiền hay vai trò do trình duyệt gửi lên. Các truy vấn dùng tham số SQL; người dùng chỉ xem/hủy đơn của mình.

## 5. API chính

| Phương thức  | Đường dẫn                                                   | Quyền                          |
| ------------ | ----------------------------------------------------------- | ------------------------------ |
| GET          | `/api/health`, `/api/products`, `/api/products/:id`         | Công khai                      |
| POST         | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Công khai                      |
| GET          | `/api/auth/me`                                              | Trả về người dùng hoặc null    |
| GET / POST   | `/api/orders`                                               | Đăng nhập                      |
| PATCH        | `/api/orders/:id/status`                                    | Chủ đơn hủy đơn chờ hoặc admin |
| GET / POST   | `/api/admin/products`                                       | Admin                          |
| PUT / DELETE | `/api/admin/products/:id`                                   | Admin                          |
| GET          | `/api/admin/orders`, `/api/admin/stats`                     | Admin                          |

`POST /api/orders` nhận `{recipient, phone, address, payment, requestKey, items: [{productId, quantity}]}`. `payment` là `cod` hoặc `demo_card`; `requestKey` là UUID mới cho mỗi lần checkout. Phí giao hàng 30.000đ, miễn phí từ 800.000đ.

## 6. Kiểm thử và chạy bản build

```bash
npm test
npm run build
npm start
```

Bản build chạy tại **http://localhost:3001**, có cả giao diện lẫn API. `npm run preview` chỉ phục vụ giao diện Vite, hãy dùng `npm start` khi muốn demo đầy đủ bản build.

Các kiểm thử xác minh đăng ký/đăng nhập, phân quyền, validation, quyền sở hữu đơn, giá tính ở server, tồn kho và rollback, gửi trùng đơn, hủy/hoàn kho, CRUD sản phẩm, trạng thái đơn, doanh thu, hết hạn phiên, SQLite qua khởi động lại và logic giỏ hàng/lọc sản phẩm.

GitHub Actions chỉ chạy kiểm thử và build; không tự xuất bản website. GitHub Pages chỉ chạy được frontend tĩnh, không chạy Express/SQLite của phiên bản này.

## 7. Dữ liệu và xử lý lỗi thường gặp

- Node báo không có `node:sqlite`: cài Node.js 24, kiểm tra `node -v` và mở terminal mới.
- Cổng 5173 hoặc 3001 đang bận: đóng phiên chạy demo cũ bằng `Ctrl+C`. Vite không tự đổi cổng để tránh mở nhầm ứng dụng.
- API không kết nối: chạy `npm run dev` thay vì chỉ mở file `index.html` hoặc dùng Live Server.
- Dữ liệu nằm ở `data/may.sqlite` và được gitignore. Không xóa khi máy chủ đang chạy. Muốn làm lại dữ liệu mẫu: dừng máy chủ, đổi tên thư mục `data` thành bản sao lưu, rồi chạy lại.
- Biến tùy chọn `PORT` đổi cổng bản `npm start`, `DB_PATH` đổi vị trí SQLite. Mặc định dev proxy dùng API cổng 3001, nên để nguyên `PORT` khi chạy `npm run dev`.
- Không chỉnh file `dist` hoặc `node_modules`. Đổi code trong `src`/`server`, rồi build lại nếu dùng `npm start`.

Khi đưa vào CV, mô tả đúng đây là **dự án cá nhân/demo** và chỉ ghi những phần bạn đã đọc, chạy và giải thích được.
