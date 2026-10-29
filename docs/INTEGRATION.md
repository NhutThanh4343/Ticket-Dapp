# Hướng dẫn nối UI với contract

Các module dùng JavaScript ES modules và ethers.js v6; không phụ thuộc React. Chưa tạo frontend hoặc contract thay phần của thành viên khác.

## Cấu hình và ABI

Điền bốn biến trong `.env.local` từ `.env.example`. Chỉ dùng testnet đã được nhóm thống nhất. Không có địa chỉ hoặc mạng mặc định. `readBlockchainConfig()` trả `{ chainId: bigint, rpcUrl, contractAddress, adminAddress }`; cấu hình thiếu/sai báo `CONFIG_ERROR`.

`src/contracts/tourTicketAbi.js` là ABI viết theo quy ước để chuẩn bị code, không xác nhận có deployment. Thay bằng ABI compile thật trước khi tích hợp testnet. Không giả định có getter `admin()` hoặc `getTicket()` vì đặc tả không quy định hai hàm này. Địa chỉ admin trên UI dùng cấu hình chung; kiểm tra quyền thật thuộc contract.

## Kết nối ví

```js
import { walletService, ticketService } from './src/index.js';

// Chạy khi người dùng bấm nút kết nối; không gọi lúc render React.
const wallet = await walletService.connect();
console.log(wallet.account, wallet.isAdmin, wallet.isCorrectNetwork);

// Thử khôi phục quyền đã cấp, không mở yêu cầu cấp quyền mới.
await walletService.restore();

// Chỉ gọi khi người dùng bấm nút chuyển mạng. Mạng chưa có cần thêm trong ví.
await walletService.switchNetwork();

const unsubscribe = walletService.subscribe((state) => {
  // Cập nhật tài khoản/quyền/mạng; xóa ngay vé của tài khoản trước đó.
  // Nếu connected && isCorrectNetwork: tải lại vé hiện tại.
  // Hủy/bỏ qua các request UI cũ để chúng không ghi đè dữ liệu ví mới.
  console.log(state);
});

// Khi component unmount:
unsubscribe();

// Nút ngắt kết nối cục bộ; không thu hồi quyền của website trong MetaMask.
walletService.disconnect();
```

Trạng thái ví gồm `account`, `chainId`, `connected`, `isAdmin`, `isCorrectNetwork`, `revision`. `getState()` lấy bản chụp hiện tại; `subscribe()` chỉ nhận các lần thay đổi tiếp theo. Trong React, khởi tạo state bằng `getState()`, đăng ký trong `useEffect` và trả hàm hủy đăng ký. `getSession()` luôn tạo signer mới và kiểm tra lại tài khoản/mạng; request vé đang đọc bị loại bỏ nếu phiên ví thay đổi.

Module chọn MetaMask trong `window.ethereum.providers` nếu có, nếu không dùng `window.ethereum`. Với host dùng EIP-6963, có thể truyền provider MetaMask đã chọn vào factory `createWalletService({ ethereum, getConfig })`; không cần SDK MetaMask riêng. Nếu tạo instance ví riêng, truyền cùng instance vào `createTicketService({ wallet, getConfig })`.

## Gọi dịch vụ

```js
import { parseEther, formatEther } from 'ethers';
import { ticketService } from './src/index.js';

// Đọc qua RPC công khai: không cần ví hay yêu cầu ký.
const tours = await ticketService.listTours();
const tour = await ticketService.readTour(0n);
console.log(formatEther(tour.price));

// Giá nhập ETH phải là chuỗi; datetime-local dùng múi giờ trình duyệt.
const date = new Date('2030-01-01T08:00');
if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
  throw new Error('Giờ khởi hành phải ở tương lai.');
}
const created = await ticketService.createTour({
  name: 'Tour Đà Lạt',
  departureTime: BigInt(Math.floor(date.getTime() / 1000)),
  price: parseEther('0.01'),
  totalTickets: 30n,
});
// created: { tourId: bigint, txHash: string }

const purchased = await ticketService.purchaseTicket(0n);
// purchased: { ticketId: bigint, txHash: string }
const tickets = await ticketService.listMyTickets();
// Cần ví hiện tại; bao gồm cả vé đã dùng, không cần ký giao dịch đọc.

await ticketService.useTicket(purchased.ticketId);
// { txHash: string }; chỉ admin được contract cho phép.
```

Các đoạn trên minh họa API, không phải kịch bản chạy nguyên khối: tạo/sử dụng vé cần ví admin, mua/xem vé cần ví người mua. Admin cũng có thể mua vé. Contract quyết định thời gian hợp lệ theo `block.timestamp`; UI kiểm tra trước để hướng dẫn người dùng.

`listTours()`/`readTour()` trả `Tour` đủ sáu trường theo thứ tự quy ước; `listMyTickets()` trả `Ticket` đủ bốn trường. Các `uint256` giữ nguyên `bigint`; ID `0n` hợp lệ. Dùng `id.toString()` làm key/nhãn; không kiểm tra tồn tại bằng `if (!id)`. Chỉ đổi timestamp sang Number trong phạm vi ngày JavaScript hỗ trợ để hiển thị `new Date(Number(tour.departureTime) * 1000)`. Không `JSON.stringify()` trực tiếp bigint.

`purchaseTicket()` tự đọc giá hiện tại và gửi `{ value: tour.price }`; không nhận owner/price từ UI. Contract vẫn kiểm tra tồn tại, giờ khởi hành, số vé và giá trị thanh toán. Không suy ra ID mới từ độ dài danh sách.

## Trạng thái giao dịch và tải lại dữ liệu

```js
const unsubscribeTx = ticketService.subscribeTransactions((state) => {
  const busy = ['preparing', 'awaiting_signature', 'pending'].includes(state.status);
  // Dùng busy để khóa các nút ghi; hiển thị state.txHash khi đã gửi.
  // success: báo thành công, tải lại các nhóm dữ liệu trong state.refresh.
  // error: hiển thị state.error.message.
  console.log(busy, state);
});

try {
  await ticketService.purchaseTicket(0n);
} catch (error) {
  console.error(error.code, error.message);
}
// Hủy subscription khi component unmount.
unsubscribeTx();
```

Một instance dịch vụ chỉ cho phép một giao dịch ghi đang xử lý. Trạng thái lần lượt `preparing` → `awaiting_signature` → `pending` → `success` hoặc `error`. Chỉ phát `success` sau receipt có `status === 1` và giải mã được event từ đúng địa chỉ contract. `awaiting_signature` cũng có thể bao gồm thời gian chuẩn bị/gas estimation trước khi ví hiện yêu cầu ký.

| Thao tác thành công | `refresh` |
| --- | --- |
| Tạo tour | `['tours']` |
| Mua vé | `['tours', 'myTickets']` |
| Sử dụng vé | `['myTickets']` |

Dịch vụ cung cấp tín hiệu `refresh`; UI thực hiện tải lại danh sách/chi tiết và trạng thái vé đang hiển thị. Admin không thể dùng `getMyTickets()` để đọc vé khách hàng: cần làm mới nguồn dữ liệu vé đang dùng trên UI nếu có; đặc tả hiện không có hàm tra cứu mọi vé hoặc tra vé bất kỳ theo ID.

Giao dịch có thể xác nhận sau khi người dùng đổi ví. `state.account` ghi nhận tài khoản gửi ban đầu; UI tải lại vé cho tài khoản đang kết nối và bỏ qua kết quả đọc cũ. Nếu có `txHash` nhưng chờ receipt gặp lỗi RPC, trạng thái giao dịch có thể chưa rõ: kiểm tra lại hash trước khi gửi lần nữa.

Nếu receipt đã thành công nhưng thiếu event mong đợi, dịch vụ báo `RECEIPT_EVENT_MISSING` với `confirmed: true` và tín hiệu `refresh`. Không tự gửi lại giao dịch; kiểm tra ABI và tải lại dữ liệu. Giao dịch tăng phí được nhận diện qua receipt thay thế; giao dịch hủy/thay thao tác khác báo lỗi tương ứng.

## Lỗi và kiểm thử

`IntegrationError` có `code`, `message` tiếng Việt, và `cause` khi có lỗi gốc. Module giải mã 12 custom error trong quy ước, cùng lỗi từ chối, thiếu tiền, sai mạng, mất RPC, chưa kết nối ví và đang có giao dịch chờ. Revert không giải mã được vẫn có thông báo dự phòng. Khi thay ABI compile, các error bổ sung của contract như chống reentrancy dùng thông báo dự phòng nếu chưa có bản dịch.

`npm test` chạy kiểm thử Node với provider/contract mô phỏng, dùng Interface ethers thật để encode/decode ABI, event và error. Chưa gửi giao dịch hoặc kiểm chứng logic Solidity, thanh toán doanh thu, reentrancy hay hành vi extension MetaMask thật. Sau bàn giao deployment, chạy đủ 10 mục nghiệm thu trong quy ước, gồm ví A/B, ID 0, quyền admin và tiền về admin.

Tham khảo API: [ethers v6](https://docs.ethers.org/v6/getting-started/) và [MetaMask provider](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/).
