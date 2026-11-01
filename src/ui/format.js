import { formatEther } from 'ethers';

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
export const formatPrice = (wei) => `${formatEther(wei)} ETH`;
export const shortAddress = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;
export const remainingTickets = (tour) => tour.totalTickets > tour.soldTickets ? tour.totalTickets - tour.soldTickets : 0n;
export const hasDeparted = (tour, now = Date.now()) => tour.departureTime <= BigInt(Math.floor(now / 1000));

export function formatDeparture(timestamp) {
  if (timestamp < 0n || timestamp > 8640000000000n) return 'Ngày ngoài phạm vi hiển thị';
  return new Date(Number(timestamp) * 1000).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
