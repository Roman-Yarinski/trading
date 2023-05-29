// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

import {IERC20WithDecimals} from "./interfaces/IERC20WithDecimals.sol";
import {ISwapHelperUniswapV3} from "./interfaces/ISwapHelperUniswapV3.sol";
import {Counters} from "@openzeppelin/contractsV4/utils/Counters.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contractsV4/token/ERC20/utils/SafeERC20.sol";
import {AccessControlEnumerable, EnumerableSet} from "@openzeppelin/contractsV4/access/AccessControlEnumerable.sol";

/**
 * @title The contract implements the token trading platform
 */
contract TradingPlatform is AutomationCompatibleInterface, AccessControlEnumerable {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint32 public constant PRECISION = 1000000; // 10000 = 1%
    uint32 public constant MAX_ITERATIONS = 1000;

    address feeRecipient;

    uint32 _secondsAgoDefault = 120;

    uint32 protocolFee = 10000;

    address _uniswapHelperV3;

    EnumerableSet.AddressSet private _tokensWhiteList;
    EnumerableSet.UintSet private _activeOrders;

    mapping(uint256 => Order) private orderInfo;
    mapping(uint256 => uint256) private additionalInformation; // orderId => info  last execution time for DCA || last execution price for trailing
    // mapping(uint256 => uint256) private ResultTokenOut; // TODO: orderId => amount of token  Fro DCA and TRAILING

    mapping(address => mapping(address => uint256)) private balances; // UserAddress -> TokenAddress -> Amount
    mapping(address => uint256[]) private userOrders; // All orders for user

    Counters.Counter private tokenCounter; // How many tokens we are supported
    Counters.Counter private orderCounter; // How many orders we have

    struct Order {
        address userAddress;
        address baseToken;
        address targetToken;
        uint24 pairFee;
        uint24 slippage;
        uint128 baseAmount;
        uint128 aimTargetTokenAmount;
        uint128 minTargetTokenAmount; // minTargetTokenAmount < aimTargetTokenAmount if sell && minTargetTokenAmount > aimTargetTokenAmount if buy
        uint256 expiration;
        uint256[] boundOrders;
        Action action;
        bytes data; // additional data for different orders types
    }

    struct OrderInfo {
        uint256 id;
        Order order;
        uint256 additionalInformation; // last execution time for DCA || last execution price for trailing
        // bool status;
    }

    struct TrailingOrderData {
        uint128 baseAmount; // duplicatecate for calculation
        uint128 fixingPerStep; // amount of base token for fixing on each step
        uint24 step; // step in percents
    }

    struct DCAOrderData {
        uint128 period; // period of buying
        uint128 amountPerPeriod; // amount of baseToken for spend per period
    }

    enum Action {
        LOSS,
        PROFIT,
        DCA,
        TRAILING
    }

    event Deposited(address operator, address token, uint256 amount);
    event OrderCreated(uint256 orderId, address userAddress);
    event OrderExecuted(uint256 orderId, address validator);
    event Withdrawed(address operator, address token, uint256 amount);
    event TokenAdded(address token);
    event TokenRemoved(address token);
    event OrdersBounded(uint256[] leftOrders, uint256[] rightOrders);
    event OrderCanceled(uint256 orderId);

    /**
     * @notice TODO:
     */
    constructor(address uniswapHelperV3_, address admin) {
        require(uniswapHelperV3_ != address(0), "UniswapHelperV3 zero address");
        require(admin != address(0), "Admin zero address");
        _setupRole(ADMIN_ROLE, admin);
        _uniswapHelperV3 = uniswapHelperV3_;
    }

    /**
     * @notice Returns a address of uniswapHelperV3
     */
    function getSwapHelper() external view returns (address) {
        return _uniswapHelperV3;
    }

    /**
     * @notice Returns a address of feeRecipient
     */
    function getFeeRecipient() external view returns (address) {
        return feeRecipient;
    }

    /**
     * @notice Returns a address of feeRecipient
     */
    function getProtocolFee() external view returns (uint32) {
        return protocolFee;
    }

    /**
     * @notice Returns a address of feeRecipient
     */
    function setProtocolFee(uint32 newProtocolFee) external {
        // TODO: add role
        require(newProtocolFee < PRECISION);
        protocolFee = newProtocolFee;
    }

    function getTokenStatus(address token) external view returns (bool) {
        return _tokensWhiteList.contains(token);
    }

    function getUserOrdersIds(address userAddress) external view returns (uint256[] memory) {
        return userOrders[userAddress];
    }

    function getUserOrdersInfo(address userAddress) external view returns (OrderInfo[] memory) {
        uint256[] memory userOrdersIds = userOrders[userAddress];
        return getOrdersInfo(userOrdersIds);
    }

    function getUserBalance(address user, address token) external view returns (uint256) {
        return balances[user][token];
    }

    function getOrderCounter() external view returns (uint256) {
        return orderCounter.current();
    }

    function getOrdersInfo(uint256[] memory ordersIds) public view returns (OrderInfo[] memory orders) {
        orders = new OrderInfo[](ordersIds.length);
        for (uint256 i = 0; i < ordersIds.length; i++) {
            orders[i] = OrderInfo(ordersIds[i], orderInfo[ordersIds[i]], additionalInformation[ordersIds[i]]);
        }
        return orders;
    }

    /**
     * @notice Returns a boolean indicating whether the payment token exists
     * @param orderId Order id
     */
    function isActiveOrderExist(uint256 orderId) external view returns (bool) {
        return _activeOrders.contains(orderId);
    }

    /**
     * @notice Returns a payment tokens count
     */
    function activeOrdersLength() external view returns (uint256) {
        return _activeOrders.length();
    }

    /**
     * @notice Returns a active order by index
     * @param itemId Index in active orders list
     */
    function activeOrderId(uint256 itemId) external view returns (uint256) {
        require(itemId < _activeOrders.length(), "Invalid token id");
        return _activeOrders.at(itemId);
    }

    /**
     * @notice Returns a payment tokens by pagination params
     * @param offset Number of skipped elements
     * @param limit Number of items requested
     */
    function activeOrdersIds(uint256 offset, uint256 limit) external view returns (uint256[] memory ordersIds) {
        uint256 ordersCount = _activeOrders.length();
        if (offset >= ordersCount) return new uint256[](0);
        uint256 to = offset + limit;
        if (ordersCount < to) to = ordersCount;
        ordersIds = new uint256[](to - offset);
        for (uint256 i = 0; i < ordersIds.length; i++) ordersIds[i] = _activeOrders.at(offset + i);
    }

    function addTokensToWhitelist(address[] memory tokens) external onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Token zero address check");
            if (_tokensWhiteList.contains(tokens[i])) continue;
            _tokensWhiteList.add(tokens[i]);
            emit TokenAdded(tokens[i]);
        }
    }

    function removeTokensFromWhitelist(address[] memory tokens) external onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (!_tokensWhiteList.contains(tokens[i])) continue;
            _tokensWhiteList.remove(tokens[i]);
            emit TokenRemoved(tokens[i]);
        }
    }

    function createOrder(Order memory order) external returns (uint256 orderId) {
        // TODO: add checks
        require(order.userAddress == msg.sender, "Wrong user address");
        require(order.baseToken != address(0), "Zero address check");
        require(order.targetToken != address(0), "Zero address check");
        require(order.baseToken != order.targetToken, "Tokens must be different");
        require(order.baseAmount > 0, "Amount in must be greater than 0");
        require(order.slippage > 0 && order.slippage < 50000, "Unsafe slippage");
        if (order.action != Action.DCA) {
            require(order.aimTargetTokenAmount > 0, "Aim amount must be greater than 0");
            require(order.expiration > block.timestamp, "Wrong expiration date");
        }
        require(
            _tokensWhiteList.contains(order.baseToken) && _tokensWhiteList.contains(order.targetToken),
            "Token not allowed"
        );
        // require(action != Action.LOSS || targetPrice > 0, "Minimum amount out must be greater than 0");
        // require(
        //     action != Action.TakeProfit || minTargetTokenAmount > 0,
        //     "Take profit amount out must be greater than 0 for TakeProfit orders"
        // );
        orderCounter.increment();
        orderId = orderCounter.current();
        if (order.action == Action.DCA) {
            DCAOrderData memory decodedData = abi.decode(order.data, (DCAOrderData));
            require(decodedData.amountPerPeriod > 0, "Zero amount to swap");
            additionalInformation[orderId] = block.timestamp;
        }
        if (order.action == Action.TRAILING) {
            TrailingOrderData memory decodedData = abi.decode(order.data, (TrailingOrderData));
            require(decodedData.fixingPerStep > 0, "Zero amount to swap");
            require(decodedData.baseAmount == order.baseAmount, "Wrong base amount");
            require(decodedData.step > 0, "Wrong base amount");
        }
        if (order.boundOrders.length > 0) {
            for (uint256 i = 0; i < order.boundOrders.length; i++) {
                uint256 boundOrderId = order.boundOrders[i];
                require(orderInfo[boundOrderId].userAddress == msg.sender, "Bound order is not yours");
                require(_activeOrders.contains(boundOrderId), "Bound order is not active");
                orderInfo[boundOrderId].boundOrders.push(orderId);
            }
        }
        _activeOrders.add(orderId);
        userOrders[msg.sender].push(orderId);
        orderInfo[orderId] = order;

        uint256 baseTokenUserBalance = balances[msg.sender][order.baseToken];
        if (baseTokenUserBalance < order.baseAmount) {
            uint256 neededAmount = order.baseAmount - baseTokenUserBalance;
            if (baseTokenUserBalance != 0) balances[msg.sender][order.baseToken] = 0;
            IERC20(order.baseToken).safeTransferFrom(msg.sender, address(this), neededAmount);
        } else {
            balances[msg.sender][order.baseToken] -= order.baseAmount;
        }
        emit OrderCreated(orderId, msg.sender);
        return orderId;
    }

    function deposit(address token, uint256 amount) external returns (bool) {
        require(_tokensWhiteList.contains(token), "Token not allowed");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender][token] += amount;
        emit Deposited(msg.sender, token, amount);
        return true;
    }

    function withdraw(address token, uint256 amount) external returns (bool) {
        require(balances[msg.sender][token] >= amount, "Amount exceed balance");
        balances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawed(msg.sender, token, amount);
        return true;
    }

    function boundOrders(uint256[] calldata leftOrders, uint256[] calldata rightOrders) external {
        require(leftOrders.length == rightOrders.length && leftOrders.length > 0, "Non-compatible lists");
        for (uint256 i = 0; i < leftOrders.length; i++) {
            require(
                orderInfo[leftOrders[i]].userAddress == msg.sender &&
                    orderInfo[rightOrders[i]].userAddress == msg.sender,
                "Not your order"
            );
            require(
                orderInfo[leftOrders[i]].action != Action.DCA &&
                    orderInfo[leftOrders[i]].action != Action.TRAILING &&
                    orderInfo[rightOrders[i]].action != Action.DCA &&
                    orderInfo[rightOrders[i]].action != Action.TRAILING,
                "Can't bound DCA or TRAILING"
            );
            require(leftOrders[i] != rightOrders[i], "Can't bound an order to yourself");
            orderInfo[leftOrders[i]].boundOrders.push(rightOrders[i]);
            orderInfo[rightOrders[i]].boundOrders.push(leftOrders[i]);
        }
        emit OrdersBounded(leftOrders, rightOrders);
    }

    function shouldRebalance() public view returns (uint256[] memory) {
        //get Active Orders
        uint256 ordersCount = _activeOrders.length(); // TODO: -1 ?
        uint256 to = MAX_ITERATIONS;
        if (ordersCount < to) to = ordersCount;
        uint256[] memory ordersIds = new uint256[](to);
        uint256 skipped = 0;

        for (uint256 i = 0; i < to; i++) {
            uint256 orderId = _activeOrders.at(i);
            if (checkOrder(orderId)) {
                ordersIds[i - skipped] = orderId;
            } else {
                skipped++;
            }
        }

        if (skipped > 0) {
            uint256 newLength = to - skipped;
            assembly {
                mstore(ordersIds, newLength)
            }
        }
        return ordersIds;
    }

    function checkUpkeep(
        bytes calldata /* checkData */
    ) external view returns (bool upkeepNeeded, bytes memory performData) {
        uint256[] memory ordersIds = shouldRebalance();
        upkeepNeeded = ordersIds.length > 0;
        performData = abi.encode(ordersIds);
    }

    function performUpkeep(bytes calldata performData) external {
        uint256[] memory ordersIds = abi.decode(performData, (uint256[]));
        require(ordersIds.length > 0, "Nothing for execution");
        executeOrders(ordersIds);
    }

    function executeOrders(uint256[] memory ordersIds) public returns (bool) {
        for (uint256 i = 0; i < ordersIds.length; i++) {
            if (!checkOrder(ordersIds[i])) {
                continue;
            }
            executeOrder(ordersIds[i]);
        }
        return true;
    }

    function executeOrder(uint256 orderId) internal {
        Order memory order = orderInfo[orderId];
        uint128 amountToSwap = order.baseAmount;
        if (order.action == Action.TRAILING) {
            TrailingOrderData memory decodedData = abi.decode(order.data, (TrailingOrderData));
            uint256 expectedAmountOut = ISwapHelperUniswapV3(_uniswapHelperV3).getAmountOut(
                order.baseToken,
                order.targetToken,
                decodedData.baseAmount,
                order.pairFee,
                _secondsAgoDefault
            );
            uint256 lastBuyingAmountOut = additionalInformation[orderId];
            if (
                lastBuyingAmountOut == 0 ||
                expectedAmountOut >= lastBuyingAmountOut + getPercent(lastBuyingAmountOut, decodedData.step)
            ) {
                if (decodedData.fixingPerStep > order.baseAmount) {
                    _activeOrders.remove(orderId); //update active orders set
                } else {
                    // update storage only if this info will be needed in future
                    amountToSwap = decodedData.fixingPerStep;
                    additionalInformation[orderId] = expectedAmountOut;
                    orderInfo[orderId].baseAmount -= amountToSwap;
                }
            } else if (expectedAmountOut < lastBuyingAmountOut - getPercent(lastBuyingAmountOut, decodedData.step)) {
                amountToSwap = order.baseAmount;
                _activeOrders.remove(orderId); //update active orders set
            }
        } else if (order.action == Action.DCA) {
            DCAOrderData memory decodedData = abi.decode(order.data, (DCAOrderData));
            amountToSwap = decodedData.amountPerPeriod;
            if (decodedData.amountPerPeriod > order.baseAmount) {
                amountToSwap = order.baseAmount;
                _activeOrders.remove(orderId); //update active orders set
            } else {
                // update storage only if this info will be needed in future
                additionalInformation[orderId] = block.timestamp;
                orderInfo[orderId].baseAmount -= amountToSwap;
            }
        } else if (order.action == Action.LOSS || order.action == Action.PROFIT) {
            _activeOrders.remove(orderId); //update active orders set
            if (order.boundOrders.length > 0) {
                for (uint256 i = 0; i < order.boundOrders.length; i++) {
                    if (_activeOrders.contains(order.boundOrders[i])) {
                        Order memory boundOrder = orderInfo[order.boundOrders[i]];
                        _activeOrders.remove(order.boundOrders[i]);
                        balances[boundOrder.userAddress][boundOrder.baseToken] += boundOrder.baseAmount;
                    } // remove all bound orders and refund tokens to user balance
                }
            }
        }
        IERC20(order.baseToken).approve(_uniswapHelperV3, amountToSwap);
        uint256 amountOut = ISwapHelperUniswapV3(_uniswapHelperV3).swap( // TODO: add user slippage ?
            order.userAddress,
            order.baseToken,
            order.targetToken,
            amountToSwap,
            order.pairFee
        );
        uint256 feeAmount = calculateFee(amountOut);
        if (order.action == Action.LOSS || order.action == Action.PROFIT)
            require(order.minTargetTokenAmount < amountOut - feeAmount, "Unfair exchange"); // TODO: order.minTargetTokenAmount < amountOut - feeAmount ?
        balances[feeRecipient][order.targetToken] += feeAmount; // update fee balance
        balances[order.userAddress][order.targetToken] += amountOut - feeAmount; // update user balance
        emit OrderExecuted(orderId, msg.sender);
    }

    function cancelOrders(uint256[] memory ordersIds) external {
        for (uint256 i = 0; i < ordersIds.length; i++) {
            if (!_activeOrders.contains(ordersIds[i])) continue;
            Order memory order = orderInfo[ordersIds[i]];
            require(order.userAddress == msg.sender, "Not your order");
            _activeOrders.remove(ordersIds[i]);
            balances[order.userAddress][order.baseToken] += order.baseAmount;
            emit OrderCanceled(ordersIds[i]);
        }
    }

    function calculateFee(uint256 amount) public view returns (uint256) {
        return (amount * protocolFee) / PRECISION;
    }

    function checkOrder(uint256 orderId) public view returns (bool) {
        if (!_activeOrders.contains(orderId)) return false; // Not active
        Order memory order = orderInfo[orderId];
        if ((order.action != Action.DCA || order.action != Action.TRAILING) && order.expiration < block.timestamp) {
            return false;
        }
        if (order.action == Action.DCA) {
            DCAOrderData memory decodedData = abi.decode(order.data, (DCAOrderData));
            if (block.timestamp >= decodedData.period + additionalInformation[orderId]) return true;
            return false;
        }
        if (order.action == Action.TRAILING) {
            TrailingOrderData memory decodedData = abi.decode(order.data, (TrailingOrderData));
            uint256 expectedAmountOutForTrailing = ISwapHelperUniswapV3(_uniswapHelperV3).getAmountOut(
                order.baseToken,
                order.targetToken,
                decodedData.baseAmount,
                order.pairFee,
                _secondsAgoDefault
            );
            uint256 lastBuyingAmountOut = additionalInformation[orderId];
            if (
                (lastBuyingAmountOut == 0 && expectedAmountOutForTrailing >= order.aimTargetTokenAmount) ||
                (lastBuyingAmountOut != 0 && // true
                    (expectedAmountOutForTrailing >=
                        lastBuyingAmountOut + getPercent(lastBuyingAmountOut, decodedData.step) ||
                        expectedAmountOutForTrailing <
                        lastBuyingAmountOut - getPercent(lastBuyingAmountOut, decodedData.step)))
            ) return true;
        }
        uint256 expectedAmountOut = ISwapHelperUniswapV3(_uniswapHelperV3).getAmountOut(
            order.baseToken,
            order.targetToken,
            order.baseAmount,
            order.pairFee,
            _secondsAgoDefault
        );
        if (
            order.action == Action.LOSS &&
            expectedAmountOut <= order.aimTargetTokenAmount &&
            expectedAmountOut > order.minTargetTokenAmount
        ) return true;
        if (order.action == Action.PROFIT && expectedAmountOut >= order.aimTargetTokenAmount) {
            return true;
        }
        return false;
    }

    function getPercent(uint256 amount, uint24 percent) internal pure returns (uint256) {
        return (amount * percent) / PRECISION;
    }
}
