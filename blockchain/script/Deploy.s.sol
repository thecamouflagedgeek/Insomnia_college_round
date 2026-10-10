// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CaseAuditRegistry} from "../src/CaseAuditRegistry.sol";

contract Deploy is Script {
    function run() external returns (CaseAuditRegistry reg) {
        address anchorer = vm.envAddress("RELAYER_ADDRESS");
        vm.startBroadcast();
        reg = new CaseAuditRegistry(anchorer);
        vm.stopBroadcast();
        console.log("CaseAuditRegistry", address(reg));
    }
}
