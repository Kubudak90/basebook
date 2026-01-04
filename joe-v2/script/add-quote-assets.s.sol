// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ILBFactory} from "src/interfaces/ILBFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AddQuoteAssetsScript
 * @notice Adds USDC and EURC as quote assets to the LBFactory
 */
contract AddQuoteAssetsScript is Script {
    // Base Sepolia LBFactory address
    address constant FACTORY = 0x1aF4454bdcE78b2D130b4CD8fcd867195b7a2D1B;
    
    // Base Sepolia Token addresses
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant EURC = 0x808456652fdb597867f38412077A9182bf77359F;

    function run() public {
        address deployer = vm.rememberKey(vm.envUint("PRIVATE_KEY"));
        
        console.log("Adding quote assets to LBFactory at:", FACTORY);
        console.log("Using deployer:", deployer);

        vm.startBroadcast(deployer);

        ILBFactory factory = ILBFactory(FACTORY);

        // Add USDC as quote asset
        factory.addQuoteAsset(IERC20(USDC));
        console.log("USDC added as quote asset:", USDC);

        // Add EURC as quote asset
        factory.addQuoteAsset(IERC20(EURC));
        console.log("EURC added as quote asset:", EURC);

        vm.stopBroadcast();

        console.log("All quote assets added successfully!");
    }
}
