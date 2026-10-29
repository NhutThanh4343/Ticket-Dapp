# Ticket-Dapp — TourChain

Khung integration cho DApp bán và quản lý vé du lịch theo `QUY_UOC_CHUNG.md` v1.0 và hai sơ đồ lớp/use case được cung cấp.

Hiện có module JavaScript dùng ethers.js v6 để kết nối MetaMask, đọc tour qua RPC và gọi contract. Chưa có giao diện React, source Solidity hoặc bản triển khai trên testnet. Vé theo đặc tả hiện tại là struct `Ticket`; NFT/ERC-721, backend đăng nhập và xác minh QR an toàn chưa thuộc phạm vi này.

## Cài đặt và kiểm tra

Yêu cầu Node.js 20+ và npm. Chạy:

```sh
npm install
npm run check
npm test
```

Trên PowerShell nếu `npm.ps1` bị chặn, dùng `npm.cmd` thay cho `npm`.

Sao chép `.env.example` thành `.env.local`, rồi điền chain ID testnet, RPC URL, địa chỉ contract và admin thật. Cấu hình mẫu được để trống; import module không kết nối blockchain hay mở MetaMask. Các biến `VITE_*` được Vite nạp khi có frontend và là dữ liệu công khai, không chứa private key/seed phrase. Khởi động lại Vite sau khi đổi cấu hình.

## Cấu trúc

```text
src/
  index.js                     # Điểm import chung cho UI
  config/blockchain.js         # Đọc và kiểm tra cấu hình Vite
  contracts/tourTicketAbi.js    # ABI theo đặc tả, chưa phải ABI deployment
  blockchain/errors.js         # Giải mã custom error và lỗi ví/RPC
  services/walletService.js    # Kết nối, đổi mạng, theo dõi tài khoản
  services/ticketService.js    # 6 hàm dịch vụ và trạng thái giao dịch
test/integration.test.js        # Kiểm thử với provider/contract mô phỏng
```

Xem [hướng dẫn integration](docs/INTEGRATION.md) để nối UI, theo dõi giao dịch và chuẩn bị deployment.

## Thông tin deployment còn thiếu

| Mục | Trạng thái |
| --- | --- |
| Testnet / chain ID / RPC | Chưa bàn giao |
| Địa chỉ contract / admin | Chưa bàn giao |
| ABI từ bản compile đã triển khai | Chưa bàn giao |
| Phiên bản compiler Solidity cụ thể | Chưa chốt; đặc tả yêu cầu 0.8.x |
| Optimizer và các thiết lập compile | Chưa bàn giao |

Trước khi kết nối testnet, thay ABI mẫu bằng ABI đúng bản triển khai, gồm tuple/struct, event và custom error. Cập nhật đồng bộ ABI, địa chỉ và mạng mỗi lần triển khai lại. Bộ test hiện tại không thay thế việc nghiệm thu contract thật.
