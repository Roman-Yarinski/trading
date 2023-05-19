// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.12;

import {IERC20} from "@openzeppelin/contractsV4/token/ERC20/IERC20.sol";

interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint) external;
}
