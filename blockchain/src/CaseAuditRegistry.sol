// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CaseAuditRegistry
/// @notice Append-only registry of INCOGNITO audit-chain heads. Each case is identified by
///         caseKey = keccak256("incognito:case:" ++ caseId). A head commits to every audit
///         event of that case up to `seq`; nothing here reveals case content.
contract CaseAuditRegistry {
    struct Anchor {
        bytes32 head;
        uint64 seq;
        uint64 timestamp;
    }

    address public immutable anchorer;
    mapping(bytes32 => Anchor[]) private _anchors;

    event Anchored(bytes32 indexed caseKey, uint64 indexed seq, bytes32 head, uint256 index);

    error NotAnchorer();
    error SeqNotIncreasing(uint64 last, uint64 given);
    error ZeroHead();

    constructor(address anchorer_) {
        anchorer = anchorer_;
    }

    function anchor(bytes32 caseKey, uint64 seq, bytes32 head) external {
        if (msg.sender != anchorer) revert NotAnchorer();
        if (head == bytes32(0)) revert ZeroHead();
        Anchor[] storage list = _anchors[caseKey];
        uint64 last = list.length == 0 ? 0 : list[list.length - 1].seq;
        if (seq <= last) revert SeqNotIncreasing(last, seq);
        list.push(Anchor({head: head, seq: seq, timestamp: uint64(block.timestamp)}));
        emit Anchored(caseKey, seq, head, list.length - 1);
    }

    function anchorCount(bytes32 caseKey) external view returns (uint256) {
        return _anchors[caseKey].length;
    }

    function getAnchor(bytes32 caseKey, uint256 index) external view returns (Anchor memory) {
        return _anchors[caseKey][index];
    }
}
