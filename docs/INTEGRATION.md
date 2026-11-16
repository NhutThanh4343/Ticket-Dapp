# Integration TourChain

Ứng dụng dùng các module JavaScript ES modules với ethers v6. Các hàm ghi trả kết quả sau receipt thành công; giá và số nguyên giữ dạng bigint. ID `0` hợp lệ. Giá ETH nhập dưới dạng chuỗi được chuyển bằng `parseEther`; thời gian là Unix giây.

## Luồng dữ liệu

- `listTours()` và `readTour(id)` đọc qua RPC công khai.
- `listMyTickets()` đọc bằng signer để `msg.sender` đúng ví đang kết nối.
- `createTour(input)`, `purchaseTicket(id)`, `useTicket(id)` dùng signer, chờ receipt và giải mã event từ đúng địa chỉ contract.
- `readAdmin()` đối chiếu cấu hình với getter `admin()` trên chuỗi.
- `readTicket(id)` dùng getter `tickets(id)` có sẵn trong source đã bàn giao.
- `listTickets()` truy vấn `TicketPurchased` từ block triển khai theo từng khoảng 1.000 block, khử trùng ID và đọc trạng thái ticket hiện tại theo nhóm tối đa 20 vé.

Dashboard chỉ được mở sau khi ví hiện tại đúng mạng và khớp admin trên chuỗi. Ẩn giao diện không thay thế kiểm tra quyền trong Solidity. Khi đổi ví/mạng, UI đóng admin, xóa dữ liệu vé/quản trị và bỏ các phản hồi của phiên cũ. Khách và admin tải lại dữ liệu sau giao dịch và định kỳ khi trang đang hiển thị.

Admin tạo tour với tên được trim, giá wei, thời gian giây và tổng vé. Doanh thu được tính từ tổng `price * soldTickets` vì giá tour không sửa được và contract chuyển ngay tiền mua vé về admin. Vé đã dùng vẫn nằm trong danh sách và không giảm soldTickets. Không có số liệu royalty, số dư có thể rút hay trạng thái pause trong nghiệp vụ này.

## Receipt và lỗi

Mỗi instance dịch vụ chỉ xử lý một thao tác ghi đang chờ. Trạng thái `preparing → awaiting_signature → pending → success/error` giúp UI khóa nút. Transaction state ghi tài khoản gửi ban đầu để không nhầm khi người dùng đổi ví trong lúc chờ.

ID được lấy từ event sau xác nhận, không đoán từ độ dài mảng. Transaction tăng phí dùng receipt thay thế; hủy/thay ý định trả lỗi. Nếu receipt thành công nhưng thiếu event, dịch vụ đánh dấu `confirmed: true`, yêu cầu kiểm tra ABI và tải lại dữ liệu, không tự gửi lại.

Các custom error v1.0 và lỗi ví/RPC được chuyển thành `IntegrationError` có `code`, thông báo và `cause`. RPC lỗi sau khi có hash có thể làm kết quả chờ chưa rõ; kiểm tra hash trên mạng tương ứng trước khi gửi lại. Dữ liệu contract được escape trước khi render HTML.

## Deployment

`start:local` dùng node Hardhat và deployment production thật trên node local. Có thể dùng lại deployment cũ chỉ khi runtime bytecode và admin khớp artifact/ví triển khai. Contract mới luôn bắt đầu với mảng tour/vé rỗng. Launcher chỉ dừng các tiến trình do nó tạo; node đang chạy sẵn không bị dừng.

`scripts/deploy.ts` dùng API `network.create()` của Hardhat 3; xác nhận chain ID, kiểm tra public RPC, deploy và chờ receipt trước khi ghi cấu hình. Các bản ghi CLI có địa chỉ, admin, block, hash, runtime code hash, compiler, EVM target và build profile. ABI/bytecode được xuất từ đúng artifact dùng deploy.

`deploy.html` dùng MetaMask cho bước ký và public RPC đúng mạng cho bước chờ receipt/đối chiếu admin. File tải về là `tourchain.env.txt` để tránh trình duyệt Windows đổi tên file bắt đầu bằng dấu chấm; người vận hành lưu thành `.env.local`. File chỉ chứa cấu hình công khai. Không có dịch vụ giữ khóa, mật khẩu hay seed phrase.

## Vận hành và phạm vi

Contract là v1.0 trong quy ước: một giao dịch mua một vé; tour/vé không sửa/xóa/chuyển nhượng; admin cố định là deployer; ảnh/mô tả nằm ngoài chuỗi. Các getter công khai `admin()`/`tickets(id)` do source contract cung cấp được dùng cho quản trị, không thêm giao diện Solidity mới.

Xác nhận sử dụng hiện là quy trình admin đối chiếu người trình vé với ví sở hữu. Nhập đúng địa chỉ không phải bằng chứng chữ ký/QR. Việc thêm giao thức chữ ký, hoàn tiền, NFT hoặc thay admin cần đặc tả và kiểm thử riêng.

`getTours()` và danh sách vé hiện trả toàn bộ dữ liệu của deployment; giao diện và event scanning phù hợp phạm vi v1.0. Khi dữ liệu tăng lớn cần thiết kế phân trang/indexer trước khi mở rộng. RPC cần hỗ trợ eth_call, eth_getLogs và truy cập từ trình duyệt. Việc triển khai testnet thực tế và kiểm tra extension MetaMask bằng tay là bước vận hành sau kiểm thử local.
