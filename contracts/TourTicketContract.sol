// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TourTicketContract {
    struct Tour {
        uint256 id;
        string name;
        uint256 departureTime;
        uint256 price;
        uint256 totalTickets;
        uint256 soldTickets;
    }

    struct Ticket {
        uint256 id;
        uint256 tourId;
        address owner;
        bool isUsed;
    }

    address public admin;
    Tour[] public tours;
    Ticket[] public tickets;
    mapping(address => uint256[]) public ticketIdsByOwner;

    bool private _locked;

    event TourCreated(uint256 indexed tourId, address indexed admin);
    event TicketPurchased(
        uint256 indexed ticketId,
        uint256 indexed tourId,
        address indexed buyer,
        uint256 paidAmount
    );
    event TicketUsed(uint256 indexed ticketId, address indexed admin);

    error Unauthorized();
    error EmptyTourName();
    error InvalidDepartureTime();
    error InvalidPrice();
    error InvalidTicketCount();
    error TourNotFound();
    error TicketNotFound();
    error TourAlreadyDeparted();
    error SoldOut();
    error IncorrectPayment();
    error TicketAlreadyUsed();
    error PaymentTransferFailed();

    modifier nonReentrant() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    constructor() {
        admin = msg.sender;
    }

    function createTour(
        string calldata name,
        uint256 departureTime,
        uint256 price,
        uint256 totalTickets
    ) external returns (uint256 tourId) {
        if (msg.sender != admin) revert Unauthorized();
        if (bytes(name).length == 0) revert EmptyTourName();
        if (departureTime <= block.timestamp) revert InvalidDepartureTime();
        if (price == 0) revert InvalidPrice();
        if (totalTickets == 0) revert InvalidTicketCount();

        tourId = tours.length;

        tours.push(
            Tour({
                id: tourId,
                name: name,
                departureTime: departureTime,
                price: price,
                totalTickets: totalTickets,
                soldTickets: 0
            })
        );

        emit TourCreated(tourId, msg.sender);
        return tourId;
    }

    function getTour(uint256 tourId) external view returns (Tour memory tour) {
        if (tourId >= tours.length) revert TourNotFound();
        return tours[tourId];
    }

    function getTours() external view returns (Tour[] memory allTours) {
        return tours;
    }

    function buyTicket(uint256 tourId) external payable nonReentrant returns (uint256 ticketId) {
        if (tourId >= tours.length) revert TourNotFound();
        
        Tour storage tour = tours[tourId];
        if (block.timestamp >= tour.departureTime) revert TourAlreadyDeparted();
        if (tour.soldTickets >= tour.totalTickets) revert SoldOut();
        if (msg.value != tour.price) revert IncorrectPayment();

        ticketId = tickets.length;
        tickets.push(
            Ticket({
                id: ticketId,
                tourId: tourId,
                owner: msg.sender,
                isUsed: false
            })
        );

        ticketIdsByOwner[msg.sender].push(ticketId);
        tour.soldTickets += 1;

        (bool success, ) = payable(admin).call{value: msg.value}("");
        if (!success) revert PaymentTransferFailed();

        emit TicketPurchased(ticketId, tourId, msg.sender, msg.value);
        return ticketId;
    }

    function getMyTickets() external view returns (Ticket[] memory myTickets) {
        uint256[] memory ids = ticketIdsByOwner[msg.sender];
        uint256 count = ids.length;

        myTickets = new Ticket[](count);
        for (uint256 i = 0; i < count; i++) {
            myTickets[i] = tickets[ids[i]];
        }

        return myTickets;
    }

    function markTicketUsed(uint256 ticketId) external {
        if (msg.sender != admin) revert Unauthorized();
        if (ticketId >= tickets.length) revert TicketNotFound();
        if (tickets[ticketId].isUsed) revert TicketAlreadyUsed();

        tickets[ticketId].isUsed = true;

        emit TicketUsed(ticketId, msg.sender);
    }
}