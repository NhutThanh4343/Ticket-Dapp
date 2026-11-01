# Ticket-Dapp — TourChain

Frontend khách hàng bán và quản lý vé du lịch theo `QUY_UOC_CHUNG.md` v1.0. Giao diện dùng **HTML/CSS/JavaScript thuần + Vite + ethers.js v6**, kết nối MetaMask qua module dịch vụ dùng chung. Phần Solidity và môi trường **Hardhat 3 + Mocha + ethers** được gộp từ `feature/tv2-smart-contract`.

## Chạy trên máy

Dùng Node.js 24 và npm cho cả frontend lẫn Hardhat. Môi trường đã kiểm tra: Node.js 24.14.0.

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
contracts/                     TourTicketContract.sol và mẫu Counter/Solidity tests
hardhat.config.ts              Cấu hình compiler và mạng Hardhat
test/*.test.js                 Kiểm thử dịch vụ/frontend bằng Node
test/contracts/                Kiểm thử TypeScript bằng Hardhat + Mocha
ignition/modules/              Module triển khai mẫu Counter
scripts/                       Script Hardhat mẫu
e2e/                           Kiểm thử frontend trong trình duyệt
```

Cập nhật `tourContent.js` theo ID của deployment thật. Tên, thời gian, giá và số vé luôn lấy từ contract; ảnh/mô tả tĩnh không ghi đè những trường này. Tour mới có nội dung và ảnh mặc định.

## Kiểm tra và build

```sh
npm run check
npm test
npm run compile:contracts
npm run typecheck:contracts
npm run test:contracts
npm run test:e2e
npm run build
npm run preview
```

Browser test dùng Playwright với service mô phỏng; không yêu cầu MetaMask thật và không gửi giao dịch. Trên Windows mặc định dùng Edge đã cài. Có thể chọn Chrome bằng biến môi trường `PLAYWRIGHT_CHANNEL=chrome`. Trên môi trường khác, chạy `npx playwright install chromium` trước lần kiểm thử đầu. Ảnh chụp desktop/mobile và trace khi lỗi nằm trong `test-results/`, không đưa lên Git.

`npm test` chỉ chạy các test JavaScript của frontend/service. `npm run test:contracts` chạy Solidity tests và Mocha tests trong `test/contracts/`, không chạy nhầm các file dùng `node:test`. Test `TourTicketService.ts` triển khai contract trên EVM mô phỏng và gọi service thật để kiểm tra tạo tour, mua vé ID 0, chuyển tiền về admin, quyền quản trị và sử dụng vé. Các file `.d.ts` đi kèm service/lỗi giúp test TypeScript sử dụng module frontend JavaScript.

Hardhat hiện cấu hình Solidity **0.8.34**: profile `default` không bật optimizer; profile `production` bật optimizer với `runs: 200`. Artifact được tạo dưới `artifacts/` và không đưa lên Git. Phải ghi nhận đúng profile và ABI của lần triển khai thực tế.

`npm run node:contracts` mở node phát triển cục bộ. `Counter.ts` trong Ignition và `scripts/send-op-tx.ts` là ví dụ, không phải quy trình deploy `TourTicketContract`. Cấu hình Sepolia dùng `SEPOLIA_RPC_URL` và `SEPOLIA_PRIVATE_KEY` qua biến cấu hình Hardhat; chỉ nhập bí mật trên máy/keystore, không dùng biến `VITE_*` hoặc commit chúng. Không cần khóa Sepolia để build và chạy test mô phỏng.

Build xuất thư mục `dist/`; `preview` mở bản build trên máy để kiểm tra. Giao diện admin từ `feature/frontend` được giữ dưới dạng xem trước qua nút **Xem giao diện**. Các số liệu/biểu đồ/nhật ký admin là minh họa và các nút ghi dữ liệu chưa được bật; chuyển giao diện không đăng nhập hay cấp quyền. Tích hợp admin, backend, NFT/ERC-721 và xác minh QR bổ sung sau.

## Bàn giao contract còn thiếu

Đã có `contracts/TourTicketContract.sol`, cấu hình compiler và kiểm thử service với contract trên EVM mô phỏng. Chưa có deployment testnet, địa chỉ contract/admin và cấu hình RPC dùng chung. Frontend vẫn dùng ABI theo đặc tả; trước khi bật blockchain, cập nhật ABI đúng artifact/profile đã deploy và các biến môi trường. Kiểm thử hiện tại chưa thay thế toàn bộ checklist nghiệm thu hoặc kiểm tra reentrancy/hoàn tác khi chuyển tiền thất bại.

Xem [hướng dẫn module integration](docs/INTEGRATION.md), [tài liệu Vite](https://vite.dev/guide/) và [Hardhat 3](https://hardhat.org/docs/getting-started).
