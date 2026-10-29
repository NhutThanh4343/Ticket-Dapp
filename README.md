# TourChain TV1 — Customer Frontend (Go Live)

## Mục tiêu
Bản giao diện khách hàng độc lập, chạy bằng VS Code Live Server. Không cần npm/Node.js.
Tất cả selector và class CSS đều có tiền tố `tc-` để hạn chế xung đột với code của thành viên khác.

## Chạy
1. Giải nén thư mục.
2. Mở riêng thư mục `TourChain-TV1-Frontend` trong VS Code.
3. Mở `index.html`, chọn **Open with Live Server** hoặc nhấn **Go Live**.

## File
- `index.html`: cấu trúc trang.
- `styles.css`: giao diện responsive.
- `app.js`: dữ liệu mẫu, tìm kiếm, xem chi tiết tour và nút kết nối MetaMask.

## Lưu ý tích hợp
- Đây là giao diện demo; tour đang lấy từ `TC_MOCK_TOURS`.
- Giá được biểu diễn bằng bigint wei; hiển thị ETH bằng cách định dạng chuỗi, không dùng số thực.
- ID tour bắt đầu từ `0`; các trường dữ liệu theo quy ước: `id`, `name`, `departureTime`, `price`, `totalTickets`, `soldTickets`.
- Quy tắc nghiệp vụ yêu cầu mỗi giao dịch chỉ mua một vé.
- Chưa gửi giao dịch mua thật và chưa tải vé thật, vì cần ABI và địa chỉ contract triển khai.
- Khi tích hợp, dùng module dịch vụ chung `src/services/ticketService.js` do TV3 quản lý, theo QUY_UOC_CHUNG.md. Không tự đổi chữ ký hàm Solidity.
- Không thêm seed phrase/private key vào mã nguồn hoặc GitHub.

## Tránh xung đột nhóm
Khuyến nghị lưu thư mục này tại `frontend-tv1-golive/` trong nhánh riêng, hoặc giữ ngoài thư mục gốc cho đến khi nhóm thống nhất cách merge. Không ghi đè file React của TV3/TV2.
