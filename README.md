
# TourChain – Customer Frontend

**Hệ thống bán và quản lý vé du lịch trên Blockchain**

TourChain là hệ thống bán và quản lý vé du lịch ứng dụng công nghệ Blockchain. Frontend khách hàng giúp người dùng khám phá tour, xem chi tiết chuyến đi, kết nối ví MetaMask và quản lý vé du lịch.

## 1. Giới thiệu dự án

Dự án hướng đến việc xây dựng hệ thống bán vé du lịch minh bạch, hỗ trợ quản lý tour và vé bằng Smart Contract. Khách hàng có thể sử dụng giao diện web để tìm kiếm tour và thực hiện các thao tác liên quan đến vé.

## 2. Công nghệ sử dụng

- **HTML5:** Xây dựng cấu trúc giao diện.
- **CSS3:** Thiết kế giao diện và responsive.
- **JavaScript:** Xử lý tương tác và dữ liệu trên giao diện.
- **MetaMask:** Kết nối ví Blockchain.
- **Solidity:** Xây dựng Smart Contract quản lý tour và vé.

## 3. Chức năng chính

### 3.1. Trang chủ
- Giới thiệu hệ thống TourChain.
- Điều hướng đến các chức năng chính.
- Hiển thị nội dung giới thiệu và hướng dẫn sử dụng.

### 3.2. Danh sách tour
- Hiển thị danh sách tour du lịch.
- Hiển thị tên tour, địa điểm, giá vé và ngày khởi hành.
- Hiển thị số vé còn lại.
- Tìm kiếm tour theo tên hoặc địa điểm.

### 3.3. Chi tiết tour
- Xem thông tin chi tiết của tour.
- Xem giá vé và số lượng vé còn lại.
- Cung cấp giao diện bắt đầu quy trình mua vé.

### 3.4. Kết nối MetaMask
- Yêu cầu kết nối ví MetaMask.
- Hiển thị địa chỉ ví sau khi kết nối.
- Cập nhật giao diện khi tài khoản ví thay đổi.

### 3.5. Vé của tôi
- Khu vực quản lý vé của khách hàng.
- Dự kiến hiển thị vé đã mua theo địa chỉ ví sau khi tích hợp Smart Contract.



## 4. Trạng thái phát triển

### Đã triển khai ở mức giao diện
- Hiển thị danh sách tour mẫu.
- Tìm kiếm tour.
- Xem chi tiết tour.
- Kết nối ví MetaMask.
- Hiển thị giá vé và số vé còn lại từ dữ liệu minh họa.

### Cần tích hợp tiếp
- Lấy danh sách tour từ Smart Contract.
- Thực hiện giao dịch mua vé thật.
- Lấy danh sách vé đã mua theo địa chỉ ví.
- Hiển thị trạng thái sử dụng vé từ Blockchain.
- Kiểm tra mạng Blockchain và kết quả giao dịch.

## 5. Quy ước nghiệp vụ

- Một tour có thể có nhiều vé.
- Mỗi vé tham chiếu đến tour thông qua `tourId`.
- Giá vé trên Smart Contract sử dụng đơn vị wei.
- Mỗi giao dịch mua một vé theo quy ước hiện tại.
- Các thao tác quản trị và xác nhận sử dụng vé phải tuân theo quyền hạn của Smart Contract.
- Không lưu private key hoặc seed phrase trong mã nguồn.


## 6. Định hướng phát triển

- Tích hợp dữ liệu Blockchain thực tế.
- Hoàn thiện quy trình mua vé.
- Hiển thị trạng thái giao dịch.
- Hoàn thiện chức năng quản lý vé đã mua.
- Kiểm thử giao diện trên máy tính và điện thoại.


