export const defaultTourImage = new URL('../../assets/tour-placeholder.svg', import.meta.url).href;

// Optional editorial information for this deployment, keyed by the actual tour ID.
// Never override on-chain names, prices, departure dates or inventory here.
const content = {};
const fallback = {
  location: 'Tour du lịch', tag: 'Khám phá', image: defaultTourImage,
  description: 'Xem lịch khởi hành, giá vé và số chỗ còn lại được xác nhận trên blockchain.',
};
export function withTourContent(tour) {
  return { ...tour, ...(content[tour.id.toString()] ?? fallback) };
}
