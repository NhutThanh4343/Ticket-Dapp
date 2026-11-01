export const defaultTourImage = new URL('../../assets/tour-placeholder.svg', import.meta.url).href;

// Off-chain presentation data keyed by the on-chain ID. Update this map for the
// actual deployment; it does not define a tour's name, price, date or inventory.
const content = {
  '0': { location: 'Quảng Ninh, Việt Nam', tag: 'Được yêu thích', image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=85', description: 'Khám phá cảnh quan thiên nhiên, những đảo đá vôi và hang động nổi tiếng của Vịnh Hạ Long.' },
  '1': { location: 'Đà Nẵng, Việt Nam', tag: 'Biển xanh', image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=85', description: 'Tận hưởng bãi biển, ẩm thực địa phương và những điểm tham quan nổi bật của thành phố Đà Nẵng.' },
  '2': { location: 'Lâm Đồng, Việt Nam', tag: 'Thiên nhiên', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85', description: 'Tận hưởng khí hậu mát mẻ, rừng thông, hồ nước và những điểm check-in đặc trưng của Đà Lạt.' },
  '3': { location: 'Quảng Nam, Việt Nam', tag: 'Văn hóa', image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=85', description: 'Dạo phố cổ, khám phá kiến trúc, thưởng thức món ăn địa phương và nét văn hóa đặc sắc.' },
  '4': { location: 'Lào Cai, Việt Nam', tag: 'Phiêu lưu', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85', description: 'Ngắm núi non hùng vĩ, ruộng bậc thang và trải nghiệm văn hóa vùng cao phía Bắc.' },
  '5': { location: 'Kiên Giang, Việt Nam', tag: 'Đảo ngọc', image: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=85', description: 'Thư giãn trên bãi biển, khám phá làng chài và tận hưởng cảnh hoàng hôn trên đảo.' },
};

const fallback = {
  location: 'Điểm đến đang cập nhật', tag: 'Hành trình mới', image: defaultTourImage,
  description: 'Thông tin giới thiệu đang được bổ sung. Giá vé, lịch khởi hành và số vé được đọc từ blockchain.',
};

export function withTourContent(tour) {
  return { ...tour, ...(content[tour.id.toString()] ?? fallback) };
}
