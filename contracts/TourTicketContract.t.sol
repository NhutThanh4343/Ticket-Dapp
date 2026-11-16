// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {TourTicketContract} from "./TourTicketContract.sol";

contract PaymentReceiver {
    TourTicketContract public target;
    uint256 public mode;
    bool public reentrySucceeded;
    constructor() { target = new TourTicketContract(); }
    function setMode(uint256 value) external { mode = value; }
    function create() external { target.createTour("Receiver tour", block.timestamp + 1 days, 1 ether, 2); }
    receive() external payable {
        if (mode == 1) revert("Rejected payment");
        if (mode == 2) {
            (reentrySucceeded,) = address(target).call{value: msg.value}(abi.encodeCall(target.buyTicket, (0)));
        }
    }
}

contract TourTicketContractTest is Test {
    TourTicketContract target;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    receive() external payable {}
    function setUp() public {
        vm.warp(2_000_000_000);
        target = new TourTicketContract();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }
    function create(uint256 supply) internal {
        assertEq(target.createTour("Tour", block.timestamp + 1 days, 1 ether, supply), 0);
    }
    function test_EmptyListsAndAdmin() public view {
        assertEq(target.admin(), address(this));
        assertEq(target.getTours().length, 0);
        assertEq(target.getMyTickets().length, 0);
    }
    function test_CreateValidationAndPermissions() public {
        vm.prank(alice);
        vm.expectRevert(TourTicketContract.Unauthorized.selector);
        target.createTour("Tour", block.timestamp + 1 days, 1 ether, 1);
        vm.expectRevert(TourTicketContract.EmptyTourName.selector);
        target.createTour("", block.timestamp + 1 days, 1 ether, 1);
        vm.expectRevert(TourTicketContract.InvalidDepartureTime.selector);
        target.createTour("Tour", block.timestamp, 1 ether, 1);
        vm.expectRevert(TourTicketContract.InvalidPrice.selector);
        target.createTour("Tour", block.timestamp + 1 days, 0, 1);
        vm.expectRevert(TourTicketContract.InvalidTicketCount.selector);
        target.createTour("Tour", block.timestamp + 1 days, 1 ether, 0);
        assertEq(target.getTours().length, 0);
    }
    function test_PurchaseZeroIdAndImmediateRevenue() public {
        create(2);
        uint256 beforeBalance = address(this).balance;
        vm.prank(alice);
        assertEq(target.buyTicket{value: 1 ether}(0), 0);
        assertEq(address(this).balance, beforeBalance + 1 ether);
        assertEq(address(target).balance, 0);
        assertEq(target.getTour(0).soldTickets, 1);
        vm.prank(alice);
        TourTicketContract.Ticket[] memory owned = target.getMyTickets();
        assertEq(owned.length, 1);
        assertEq(owned[0].owner, alice);
        assertEq(owned[0].tourId, 0);
        assertFalse(owned[0].isUsed);
        vm.prank(bob);
        assertEq(target.getMyTickets().length, 0);
    }
    function test_WrongPaymentDoesNotCreateTickets() public {
        create(2);
        vm.prank(alice);
        vm.expectRevert(TourTicketContract.IncorrectPayment.selector);
        target.buyTicket{value: 0.9 ether}(0);
        vm.prank(alice);
        vm.expectRevert(TourTicketContract.IncorrectPayment.selector);
        target.buyTicket{value: 1.1 ether}(0);
        assertEq(target.getTour(0).soldTickets, 0);
        vm.prank(alice);
        assertEq(target.getMyTickets().length, 0);
    }
    function test_SoldOutAndDepartureBoundary() public {
        create(1);
        vm.prank(alice);
        target.buyTicket{value: 1 ether}(0);
        vm.prank(bob);
        vm.expectRevert(TourTicketContract.SoldOut.selector);
        target.buyTicket{value: 1 ether}(0);
        vm.warp(target.getTour(0).departureTime);
        vm.prank(bob);
        vm.expectRevert(TourTicketContract.TourAlreadyDeparted.selector);
        target.buyTicket{value: 1 ether}(0);
        assertEq(target.getTour(0).soldTickets, 1);
    }
    function test_UseTicketOnlyOnceWithoutReducingSales() public {
        create(2);
        vm.prank(alice);
        target.buyTicket{value: 1 ether}(0);
        vm.prank(bob);
        vm.expectRevert(TourTicketContract.Unauthorized.selector);
        target.markTicketUsed(0);
        target.markTicketUsed(0);
        vm.expectRevert(TourTicketContract.TicketAlreadyUsed.selector);
        target.markTicketUsed(0);
        vm.prank(alice);
        TourTicketContract.Ticket[] memory owned = target.getMyTickets();
        assertTrue(owned[0].isUsed);
        assertEq(owned[0].owner, alice);
        assertEq(target.getTour(0).soldTickets, 1);
    }
    function test_NonexistentRecords() public {
        vm.expectRevert(TourTicketContract.TourNotFound.selector);
        target.getTour(0);
        vm.prank(alice);
        vm.expectRevert(TourTicketContract.TourNotFound.selector);
        target.buyTicket{value: 1 ether}(0);
        vm.expectRevert(TourTicketContract.TicketNotFound.selector);
        target.markTicketUsed(0);
    }
    function test_TransferFailureRollsBackPurchaseAndId() public {
        PaymentReceiver receiver = new PaymentReceiver();
        receiver.create();
        receiver.setMode(1);
        TourTicketContract guarded = receiver.target();
        vm.prank(alice);
        vm.expectRevert(TourTicketContract.PaymentTransferFailed.selector);
        guarded.buyTicket{value: 1 ether}(0);
        assertEq(guarded.getTour(0).soldTickets, 0);
        vm.prank(alice);
        assertEq(guarded.getMyTickets().length, 0);
        receiver.setMode(0);
        vm.prank(alice);
        assertEq(guarded.buyTicket{value: 1 ether}(0), 0);
    }
    function test_ReentrantPurchaseIsBlocked() public {
        PaymentReceiver receiver = new PaymentReceiver();
        receiver.create();
        receiver.setMode(2);
        TourTicketContract guarded = receiver.target();
        vm.prank(alice);
        guarded.buyTicket{value: 1 ether}(0);
        assertFalse(receiver.reentrySucceeded());
        assertEq(guarded.getTour(0).soldTickets, 1);
        assertEq(address(receiver).balance, 1 ether);
    }
}
