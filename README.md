# Ticket-Dapp — TourChain

Frontend khách hàng bán và quản lý vé du lịch theo `QUY_UOC_CHUNG.md` v1.0. Giao diện dùng **HTML/CSS/JavaScript thuần + Vite + ethers.js v6**, kết nối MetaMask qua module dịch vụ dùng chung.

## Chạy trên máy

Yêu cầu Node.js 20.19+ hoặc 22.12+ (khuyến nghị Node 24) và npm.

```sh
npm install
npm run dev
```

Mở URL Local mà Vite in ra. Trên PowerShell nếu `npm.ps1` bị chặn, dùng `npm.cmd` thay cho `npm`. Dùng Vite để chạy dự án; mở trực tiếp `index.html` hoặc Go Live không xử lý được import npm và cấu hình Vite.

Mặc định là **demo**: có sáu tour minh họa, tìm kiếm và xem chi tiết; nút kết nối/mua vé bị khóa, không gửi giao dịch hoặc tạo vé giả.

## Bật kết nối blockchain

Sao chép `.env.example` thành `.env.local`, đặt `VITE_DATA_MODE=blockchain` và điền thông tin testnet thật do nhóm thống nhất:

| Biến | Giá trị cần bàn giao |
| --- | --- |
| `VITE_CHAIN_ID` | Chain ID testnet, dạng thập phân hoặc hex |
| `VITE_RPC_URL` | RPC công khai hỗ trợ trình duyệt/CORS |
| `VITE_CONTRACT_ADDRESS` | Địa chỉ contract đã triển khai |
| `VITE_ADMIN_ADDRESS` | Ví triển khai/admin |

Thay ABI trong `src/contracts/tourTicketAbi.js` bằng ABI xuất từ đúng bản compile đã triển khai, gồm struct, event và custom error. Khởi động lại Vite sau khi đổi cấu hình.

Chế độ blockchain đọc tour không cần ví. Kết nối MetaMask để mua và xem vé; nếu sai mạng, dùng nút **Chuyển mạng**. Giao dịch mua chỉ được báo thành công sau receipt; danh sách tour và vé tự tải lại. Đổi tài khoản/mạng sẽ xóa vé cũ và truy vấn cho ví mới. Thiếu cấu hình hoặc lỗi RPC sẽ hiển thị lỗi và cho tải lại khi phù hợp, không tự chuyển sang dữ liệu demo.

`VITE_*` là cấu hình công khai được đưa vào frontend. Không ghi private key, seed phrase hoặc bí mật vào các biến này. `.env.local` đã được Git bỏ qua.

## Cấu trúc

```text
index.html / styles.css        Giao diện khách hàng hiện tại
app.js                         Khởi tạo frontend và dọn subscription khi HMR
src/ui/customerApp.js           Hiển thị tour/vé, sự kiện ví và giao dịch
src/ui/format.js                Giá ETH, ngày giờ và escape dữ liệu hiển thị
src/data/demoTours.js           Dữ liệu minh họa, đúng cấu trúc bigint
src/data/tourContent.js         Ảnh/mô tả/địa điểm ngoài chuỗi theo tourId
assets/tour-placeholder.svg     Ảnh mặc định cho tour mới hoặc ảnh bị lỗi
src/config/                    Cấu hình blockchain và chế độ dữ liệu
src/services/                  Kết nối ví và sáu hàm dịch vụ contract
src/contracts/tourTicketAbi.js  ABI theo đặc tả, chưa phải ABI deployment
test/                          Kiểm thử dịch vụ, cấu hình và định dạng
e2e/                           Kiểm thử frontend trong trình duyệt
```

Cập nhật `tourContent.js` theo ID của deployment thật. Tên, thời gian, giá và số vé luôn lấy từ contract; ảnh/mô tả tĩnh không ghi đè những trường này. Tour mới có nội dung và ảnh mặc định.

## Kiểm tra và build

```sh
npm run check
npm test
npm run test:e2e
npm run build
npm run preview
```

Browser test dùng Playwright với service mô phỏng; không yêu cầu MetaMask thật và không gửi giao dịch. Trên Windows mặc định dùng Edge đã cài. Có thể chọn Chrome bằng biến môi trường `PLAYWRIGHT_CHANNEL=chrome`. Trên môi trường khác, chạy `npx playwright install chromium` trước lần kiểm thử đầu. Ảnh chụp desktop/mobile và trace khi lỗi nằm trong `test-results/`, không đưa lên Git.

Build xuất thư mục `dist/`; `preview` mở bản build trên máy để kiểm tra. Không có backend, giao diện admin, NFT/ERC-721 hoặc xác minh QR trong phần hiện tại. Giao diện admin bổ sung sau.

## Bàn giao contract còn thiếu

Chưa có source Solidity, ABI compile/deployment thật, mạng/địa chỉ chung, phiên bản compiler Solidity cụ thể và thiết lập optimizer. Điền các thông tin này trước khi nghiệm thu testnet và chạy đủ checklist trong quy ước; kiểm thử mô phỏng không kiểm chứng logic Solidity hoặc chuyển doanh thu về admin.

Xem [hướng dẫn module integration](docs/INTEGRATION.md) và [tài liệu Vite](https://vite.dev/guide/).
