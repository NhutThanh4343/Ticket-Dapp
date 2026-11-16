# TourChain

Ứng dụng đặt và quản lý vé du lịch dùng HTML/CSS/JavaScript, Vite, ethers.js v6, MetaMask và Solidity trên Hardhat 3. Dữ liệu hoạt động lấy từ contract; ứng dụng không tạo tour, vé, doanh thu hoặc trạng thái sử dụng giả.

Khách xem tour không cần ví, mua từng vé bằng ETH và theo dõi vé của ví đang kết nối. Admin là ví triển khai contract, có thể tạo tour, xem tình trạng bán vé và xác nhận sử dụng vé. Tiền mua vé được chuyển ngay đến admin trong cùng giao dịch.

## Chạy local

Cài Node.js 24 và chạy tại thư mục dự án:

```powershell
npm.cmd install
npm.cmd run start:local
```

Lệnh này khởi động node Hardhat trên `127.0.0.1:8545`, triển khai contract nếu chưa có, xuất ABI/bytecode, tạo `.env.local` và mở Vite trên **http://127.0.0.1:5173**. Khi node hiện tại vẫn chạy và contract còn khớp artifact, launcher dùng lại deployment đó. Không tự tạo tour; admin tạo tour trên giao diện.

Thêm mạng Hardhat Local vào MetaMask (RPC `http://127.0.0.1:8545`, chain ID `31337`, tiền tệ `ETH`), hoặc dùng nút **Chuyển mạng** của ứng dụng. Dùng account #0 do Hardhat in trong terminal làm admin và account #1 làm khách. Đây là các tài khoản phát triển công khai: chỉ dùng trên local, không dùng chúng cho tài sản hoặc deployment Sepolia.

Node local lưu blockchain trong bộ nhớ. Dừng node sẽ mất trạng thái local; khởi động lại sẽ triển khai contract rỗng nếu deployment cũ không còn. Deployment Sepolia giữ trạng thái trên mạng Sepolia.

Nếu chạy từng bước:

```powershell
# Terminal 1
npm.cmd run node:contracts

# Terminal 2
npm.cmd run deploy:local
npm.cmd run dev
```

## Thử toàn bộ tính năng

1. Kết nối ví admin. Nút **Quản trị** xuất hiện sau khi ứng dụng đối chiếu admin trên chuỗi.
2. Vào **Tạo tour**, nhập tên, giờ khởi hành ở tương lai, giá ETH và số vé. Xác nhận trong MetaMask và chờ receipt.
3. Chuyển sang ví khách, mở chi tiết tour, mua một vé. Sau xác nhận, số vé còn lại và **Vé của tôi** cập nhật.
4. Chuyển về ví admin, vào **Sử dụng vé**, tra mã vé (ID đầu tiên là `0`), đối chiếu người trình vé với ví sở hữu và xác nhận sử dụng. Một vé chỉ dùng được một lần.
5. Chuyển lại ví khách hoặc tải lại trang để kiểm tra trạng thái vé. Dashboard admin hiển thị số tour, số vé, tổng doanh thu đã chuyển và số vé đã dùng từ dữ liệu on-chain.

Việc biết mã vé hoặc nhập đúng địa chỉ ví không tự chứng minh người trình vé sở hữu ví. Quy trình hiện tại yêu cầu admin đối chiếu người trình vé; chưa có cơ chế QR/chữ ký để thay thế bước này. Vé là struct Tour/Ticket theo quy ước v1.0, không phải NFT có thể chuyển nhượng. Ảnh/mô tả ngoài chuỗi có nội dung mặc định, có thể biên tập trong `src/data/tourContent.js`.

## Tự deploy Sepolia bằng MetaMask

Không cần nhập private key vào code hoặc gửi qua chat.

1. Chạy frontend local và mở **http://127.0.0.1:5173/deploy.html**.
2. Chọn **Sepolia**, nhập RPC Sepolia công khai hỗ trợ truy cập từ trình duyệt. URL sẽ được đưa vào frontend nên không dùng URL chứa bí mật.
3. Kết nối MetaMask bằng ví bạn muốn làm admin; ví cần Sepolia ETH để trả gas. Trang triển khai kiểm tra chain ID của RPC, yêu cầu chuyển mạng và để bạn xác nhận deployment trong MetaMask.
4. Chờ thông báo **Triển khai đã xác nhận**, ghi lại hash/address/block và tải `tourchain.env.txt`.
5. Lưu file đó thành `.env.local` tại thư mục dự án. Ví dụ trên PowerShell:

```powershell
Copy-Item -LiteralPath "$env:USERPROFILE\Downloads\tourchain.env.txt" -Destination .env.local
```

6. Dừng launcher local bằng Ctrl+C và chạy **`npm.cmd run dev`** để dùng cấu hình Sepolia. Không chạy `start:local` trong bước này vì lệnh đó cấu hình lại cho local.
7. Muốn xuất website dùng Sepolia: chạy `npm.cmd run build`, rồi phục vụ thư mục `dist/` qua HTTPS. Kiểm tra bằng `npm.cmd run preview` trước khi đưa lên hosting.

Giữ bản sao cấu hình deployment. Mỗi lần deploy tạo một contract mới; dữ liệu contract trước vẫn ở địa chỉ cũ. Nếu có hash nhưng chờ receipt gặp lỗi, kiểm tra hash trước khi deploy lại. Tool triển khai chỉ hỗ trợ chain `31337` và `11155111`.

Có thể deploy qua CLI bằng `npm.cmd run deploy:sepolia`: đặt `SEPOLIA_PUBLIC_RPC_URL` qua biến môi trường; cấu hình `SEPOLIA_RPC_URL` và `SEPOLIA_PRIVATE_KEY` qua biến môi trường/Hardhat keystore trên máy của bạn. Script kiểm tra mạng RPC, tạo `deployments/<chainId>.json`, xuất đúng ABI/bytecode và ghi cấu hình công khai. Không commit khóa hoặc dùng biến `VITE_*` cho bí mật.

## Cấu hình công khai

`.env.example` để trống thông tin deployment. Launcher hoặc trang triển khai tạo các giá trị thật:

```dotenv
VITE_DATA_MODE=blockchain
VITE_CHAIN_ID=
VITE_RPC_URL=
VITE_CONTRACT_ADDRESS=
VITE_ADMIN_ADDRESS=
VITE_DEPLOYMENT_BLOCK=
```

`VITE_DEPLOYMENT_BLOCK` xác định điểm bắt đầu truy vấn sự kiện cho dashboard vé. Ứng dụng kiểm tra mạng, bytecode tại địa chỉ và ví admin trên contract. Thiếu cấu hình hoặc RPC lỗi sẽ báo lỗi; không thay bằng dữ liệu mẫu. Khởi động lại Vite hoặc build lại sau khi đổi `.env.local`.

## Kiểm thử và build

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:contracts
npm.cmd run typecheck:contracts
npm.cmd run test:e2e
npm.cmd run build
```

- Test Node kiểm tra định dạng bigint, cấu hình, receipt, lỗi ví/RPC và thay đổi phiên ví.
- Test Solidity kiểm tra quyền, điều kiện mua, giờ khởi hành, hết vé, giá chính xác, dùng vé một lần, chuyển doanh thu, hoàn tác khi chuyển tiền thất bại và chống reentrancy.
- Test Mocha chạy service JavaScript với Solidity trên EVM mô phỏng.
- Test trình duyệt chạy node riêng ở `18545`, deploy contract thật trên node đó, ký/gửi giao dịch qua EIP-1193 bằng tài khoản local đã mở khóa và kiểm tra receipt. Service/frontend không bị thay bằng mock. Test không điều khiển extension MetaMask thật và không gửi giao dịch Sepolia. Cấu hình test được tách khỏi `.env.local` của bạn.

Playwright mặc định dùng Edge trên Windows. Có thể đặt `PLAYWRIGHT_CHANNEL=chrome`; trên Linux cài Chromium bằng `npx playwright install chromium`. Ảnh chụp và trace nằm trong `test-results/`, được Git bỏ qua.

Build dùng Solidity **0.8.34**, target **Cancun**, optimizer **200 runs** ở profile `production`, xuất ABI/bytecode cùng bản compile rồi build hai trang ứng dụng/deployment. Profile kiểm thử `default` không bật optimizer.

## Các file chính

| Đường dẫn | Vai trò |
| --- | --- |
| `contracts/TourTicketContract.sol` | Lưu tour/vé và thực thi nghiệp vụ |
| `src/services/` | Ví, đọc contract, giao dịch, receipt và event |
| `src/ui/customerApp.js` | Giao diện khách hàng |
| `src/ui/adminApp.js` | Quản trị được đối chiếu theo admin on-chain |
| `src/ui/deployApp.js` | Triển khai bằng MetaMask và xuất cấu hình |
| `scripts/start-local.mjs` | Chạy node, deploy và frontend local |
| `scripts/deploy.ts` | Deployment CLI local/Sepolia |
| `src/contracts/` | ABI và bytecode xuất từ compiler |
| `deployments/` | Thông tin deployment công khai từ CLI |

Chi tiết service và giới hạn vận hành: [INTEGRATION.md](docs/INTEGRATION.md). Tham khảo [Hardhat 3](https://hardhat.org/docs/guides/deployment/using-scripts), [ethers v6](https://docs.ethers.org/v6/) và [Vite](https://vite.dev/guide/).
