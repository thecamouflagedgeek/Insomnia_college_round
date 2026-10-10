// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CaseAuditRegistry} from "../src/CaseAuditRegistry.sol";

contract CaseAuditRegistryTest is Test {
    CaseAuditRegistry internal reg;
    address internal anchorer = address(0xA11CE);
    bytes32 internal constant CASE = keccak256("incognito:case:test");
    bytes32 internal constant HEAD1 = bytes32(uint256(0xbeef));
    bytes32 internal constant HEAD2 = bytes32(uint256(0xcafe));

    function setUp() public {
        reg = new CaseAuditRegistry(anchorer);
    }

    function test_anchorStoresAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit CaseAuditRegistry.Anchored(CASE, 1, HEAD1, 0);
        vm.prank(anchorer);
        reg.anchor(CASE, 1, HEAD1);

        assertEq(reg.anchorCount(CASE), 1);
        CaseAuditRegistry.Anchor memory a = reg.getAnchor(CASE, 0);
        assertEq(a.head, HEAD1);
        assertEq(a.seq, 1);
        assertEq(a.timestamp, block.timestamp);
    }

    function test_appendsInOrder() public {
        vm.startPrank(anchorer);
        reg.anchor(CASE, 1, HEAD1);
        reg.anchor(CASE, 3, HEAD2);
        vm.stopPrank();
        assertEq(reg.anchorCount(CASE), 2);
        assertEq(reg.getAnchor(CASE, 1).seq, 3);
    }

    function test_rejectsNonAnchorer() public {
        vm.expectRevert(CaseAuditRegistry.NotAnchorer.selector);
        reg.anchor(CASE, 1, HEAD1);
    }

    function test_rejectsNonIncreasingSeq() public {
        vm.startPrank(anchorer);
        reg.anchor(CASE, 2, HEAD1);
        vm.expectRevert(abi.encodeWithSelector(CaseAuditRegistry.SeqNotIncreasing.selector, uint64(2), uint64(2)));
        reg.anchor(CASE, 2, HEAD2);
        vm.stopPrank();
    }

    function test_rejectsZeroSeq() public {
        vm.prank(anchorer);
        vm.expectRevert(abi.encodeWithSelector(CaseAuditRegistry.SeqNotIncreasing.selector, uint64(0), uint64(0)));
        reg.anchor(CASE, 0, HEAD1);
    }

    function test_rejectsZeroHead() public {
        vm.prank(anchorer);
        vm.expectRevert(CaseAuditRegistry.ZeroHead.selector);
        reg.anchor(CASE, 1, bytes32(0));
    }

    function test_casesAreIndependent() public {
        vm.startPrank(anchorer);
        reg.anchor(CASE, 5, HEAD1);
        reg.anchor(keccak256("other"), 1, HEAD2);
        vm.stopPrank();
        assertEq(reg.anchorCount(CASE), 1);
        assertEq(reg.anchorCount(keccak256("other")), 1);
    }
}
