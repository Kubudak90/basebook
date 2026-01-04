// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ILBFactory} from "src/interfaces/ILBFactory.sol";
import {BipsConfig} from "./config/bips-config.sol";

/**
 * @title AddPresetsScript
 * @notice Adds new bin step presets (50, 100) to an existing LBFactory deployment
 */
contract AddPresetsScript is Script {
    // Base Sepolia LBFactory address
    address constant FACTORY = 0x1aF4454bdcE78b2D130b4CD8fcd867195b7a2D1B;

    function run() public {
        address deployer = vm.rememberKey(vm.envUint("PRIVATE_KEY"));
        
        console.log("Adding presets to LBFactory at:", FACTORY);
        console.log("Using deployer:", deployer);

        vm.startBroadcast(deployer);

        ILBFactory factory = ILBFactory(FACTORY);

        // Add preset for bin step 50
        BipsConfig.FactoryPreset memory preset50 = BipsConfig.getPreset(50);
        factory.setPreset(
            preset50.binStep,
            preset50.baseFactor,
            preset50.filterPeriod,
            preset50.decayPeriod,
            preset50.reductionFactor,
            preset50.variableFeeControl,
            preset50.protocolShare,
            preset50.maxVolatilityAccumulated,
            true // isOpen - allow users to create pools
        );
        console.log("Preset 50 added successfully");

        // Add preset for bin step 100
        BipsConfig.FactoryPreset memory preset100 = BipsConfig.getPreset(100);
        factory.setPreset(
            preset100.binStep,
            preset100.baseFactor,
            preset100.filterPeriod,
            preset100.decayPeriod,
            preset100.reductionFactor,
            preset100.variableFeeControl,
            preset100.protocolShare,
            preset100.maxVolatilityAccumulated,
            true // isOpen - allow users to create pools
        );
        console.log("Preset 100 added successfully");

        vm.stopBroadcast();

        console.log("All presets added successfully!");
    }
}
