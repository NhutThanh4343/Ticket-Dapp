// Specification ABI only, NOT a compiled deployment artifact.
// Replace this array with the ABI exported from the exact deployed compilation.
// No admin() or ticket lookup getter is assumed by the agreed specification.
export const tourTicketAbi = [
  'constructor()',
  'function createTour(string name, uint256 departureTime, uint256 price, uint256 totalTickets) returns (uint256 tourId)',
  'function getTour(uint256 tourId) view returns (tuple(uint256 id, string name, uint256 departureTime, uint256 price, uint256 totalTickets, uint256 soldTickets) tour)',
  'function getTours() view returns (tuple(uint256 id, string name, uint256 departureTime, uint256 price, uint256 totalTickets, uint256 soldTickets)[] allTours)',
  'function buyTicket(uint256 tourId) payable returns (uint256 ticketId)',
  'function getMyTickets() view returns (tuple(uint256 id, uint256 tourId, address owner, bool isUsed)[] myTickets)',
  'function markTicketUsed(uint256 ticketId)',
  'event TourCreated(uint256 indexed tourId, address indexed admin)',
  'event TicketPurchased(uint256 indexed ticketId, uint256 indexed tourId, address indexed buyer, uint256 paidAmount)',
  'event TicketUsed(uint256 indexed ticketId, address indexed admin)',
  'error Unauthorized()',
  'error EmptyTourName()',
  'error InvalidDepartureTime()',
  'error InvalidPrice()',
  'error InvalidTicketCount()',
  'error TourNotFound()',
  'error TicketNotFound()',
  'error TourAlreadyDeparted()',
  'error SoldOut()',
  'error IncorrectPayment()',
  'error TicketAlreadyUsed()',
  'error PaymentTransferFailed()',
];
