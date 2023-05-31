# Solidity API

## TradingPlatform

### ADMIN_ROLE

```solidity
bytes32 ADMIN_ROLE
```

### PRECISION

```solidity
uint32 PRECISION
```

### uniswapHelperV3

```solidity
address uniswapHelperV3
```

### Order

```solidity
struct Order {
  address userAddress;
  address baseToken;
  address targetToken;
  uint24 pairFee;
  uint24 slippage;
  uint128 baseAmount;
  uint128 aimTargetTokenAmount;
  uint128 minTargetTokenAmount;
  uint256 expiration;
  uint256 boundOrder;
  enum TradingPlatform.Action action;
  bytes data;
}
```

### OrderInfo

```solidity
struct OrderInfo {
  uint256 id;
  struct TradingPlatform.Order order;
  uint256 additionalInformation;
  uint256 resultTokenOut;
  bool status;
}
```

### TrailingOrderData

```solidity
struct TrailingOrderData {
  uint128 baseAmount;
  uint128 fixingPerStep;
  uint24 step;
}
```

### DCAOrderData

```solidity
struct DCAOrderData {
  uint128 period;
  uint128 amountPerPeriod;
}
```

### Action

```solidity
enum Action {
  LOSS,
  PROFIT,
  DCA,
  TRAILING
}
```

### Deposited

```solidity
event Deposited(address operator, address token, uint256 amount)
```

Emitted when tokens are deposited into the contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The address of the operator performing the deposit. |
| token | address | The address of the deposited token. |
| amount | uint256 | The amount of tokens deposited. |

### OrderCreated

```solidity
event OrderCreated(uint256 orderId, address userAddress)
```

Emitted when a new order is created.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| orderId | uint256 | The ID of the newly created order. |
| userAddress | address | The address of the user creating the order. |

### OrderExecuted

```solidity
event OrderExecuted(uint256 orderId, address validator)
```

Emitted when an order is executed.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| orderId | uint256 | The ID of the executed order. |
| validator | address | The address of the validator who executed the order. |

### Withdrawed

```solidity
event Withdrawed(address operator, address token, uint256 amount)
```

Emitted when tokens are withdrawn from the contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The address of the operator performing the withdrawal. |
| token | address | The address of the withdrawn token. |
| amount | uint256 | The amount of tokens withdrawn. |

### TokenAdded

```solidity
event TokenAdded(address token)
```

Emitted when a new token is added to the contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of the added token. |

### TokenRemoved

```solidity
event TokenRemoved(address token)
```

Emitted when a token is removed from the contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of the removed token. |

### OrdersBounded

```solidity
event OrdersBounded(uint256 leftOrderId, uint256 rightOrderId)
```

Emitted when two orders are bound together.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| leftOrderId | uint256 | The ID of the left order in the binding. |
| rightOrderId | uint256 | The ID of the right order in the binding. |

### OrderCanceled

```solidity
event OrderCanceled(uint256 orderId)
```

Emitted when an order is canceled.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| orderId | uint256 | The ID of the canceled order. |

### constructor

```solidity
constructor(address uniswapHelperV3_, address admin, uint32 protocolFee_, address feeRecipient_) public
```

Initializes the TradingPlatform contract with the specified parameters.

_The UniswapHelperV3 address, admin address, and fee recipient address must not be zero addresses.
The protocol fee must be less than 100% (represented as 1,000,000 in 6 digits precision).
Sets the DEFAULT_ADMIN_ROLE and ADMIN_ROLE roles to the admin address._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| uniswapHelperV3_ | address | The address of the UniswapHelperV3 contract. |
| admin | address | The address of the contract admin. |
| protocolFee_ | uint32 | The protocol fee percentage, represented as a decimal with 6 digits precision. |
| feeRecipient_ | address | The address where the protocol fees will be sent to. |

### getSwapHelper

```solidity
function getSwapHelper() external view returns (address)
```

Returns the address of the UniswapHelperV3 contract.

_This function is read-only and can be called by anyone._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the UniswapHelperV3 contract. |

### getFeeRecipient

```solidity
function getFeeRecipient() external view returns (address)
```

Returns the address of the fee recipient.

_This function is read-only and can be called by anyone._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the fee recipient. |

### getProtocolFee

```solidity
function getProtocolFee() external view returns (uint32)
```

Returns the current protocol fee percentage.

_This function is read-only and can be called by anyone._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 | The current protocol fee percentage. |

### setProtocolFee

```solidity
function setProtocolFee(uint32 newProtocolFee) external
```

Sets a new protocol fee percentage.

_Only the specified role can call this function.
The new protocol fee must be less than 100% (represented as 1,000,000 in 6 digits precision).
Emits a {ProtocolFeeSet} event._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newProtocolFee | uint32 | The new protocol fee percentage to be set, represented as a decimal with 6 digits precision. |

### getTokenStatus

```solidity
function getTokenStatus(address token) external view returns (bool)
```

Checks if a token is whitelisted.

_This function is read-only and can be called by anyone._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of the token to check. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | A boolean indicating whether the token is whitelisted or not. |

### getUserOrdersIds

```solidity
function getUserOrdersIds(address userAddress) external view returns (uint256[])
```

Retrieves the array of order IDs associated with a user address.

_This function is read-only and can be called by anyone._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| userAddress | address | The address of the user. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256[] | An array of order IDs associated with the user address. |

### getUserOrdersInfo

```solidity
function getUserOrdersInfo(address userAddress) external view returns (struct TradingPlatform.OrderInfo[])
```

Retrieves detailed information about the user's orders.

_This function is read-only and can be called by anyone._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| userAddress | address | The address of the user. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct TradingPlatform.OrderInfo[] | An array of OrderInfo structs containing detailed information about the user's orders. |

### getUserBalance

```solidity
function getUserBalance(address user, address token) external view returns (uint256)
```

Retrieves the balance of a specific token for a user.

_This function is read-only and can be called by anyone._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The address of the user. |
| token | address | The address of the token. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The balance of the token for the user. |

### getResultTokenOut

```solidity
function getResultTokenOut(uint256 orderId) external view returns (uint256)
```

Retrieves the result token out value for a specific order ID.

_This function is read-only and can be called by anyone._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| orderId | uint256 | The ID of the order. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The result token out value for the order. |

### getOrderCounter

```solidity
function getOrderCounter() external view returns (uint256)
```

Retrieves the current order counter.

_This function is read-only and can be called by anyone._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The current order counter value. |

### getOrdersInfo

```solidity
function getOrdersInfo(uint256[] ordersIds) public view returns (struct TradingPlatform.OrderInfo[] orders)
```

Retrieves detailed information about multiple orders.

_This function is read-only and can be called by anyone._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| ordersIds | uint256[] | An array of order IDs. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| orders | struct TradingPlatform.OrderInfo[] | An array of OrderInfo structs containing detailed information about the orders. |

### isActiveOrderExist

```solidity
function isActiveOrderExist(uint256 orderId) external view returns (bool)
```

Checks if an active order with the given ID exists.

_This function is read-only and can be called by anyone._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| orderId | uint256 | The ID of the order. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | A boolean indicating whether an active order with the given ID exists or not. |

### activeOrdersLength

```solidity
function activeOrdersLength() external view returns (uint256)
```

Retrieves the number of active orders.

_This function is read-only and can be called by anyone._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The count of active orders. |

### activeOrderId

```solidity
function activeOrderId(uint256 itemId) external view returns (uint256)
```

Retrieves the active order ID at the specified index.

_This function is read-only and can be called by anyone.
Requires the itemId to be within the valid range of activeOrders length._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| itemId | uint256 | The index of the active order in the active orders list. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The ID of the active order at the specified index. |

### activeOrdersIds

```solidity
function activeOrdersIds(uint256 offset, uint256 limit) external view returns (uint256[] ordersIds)
```

Retrieves an array of active order IDs based on pagination parameters.

_This function is read-only and can be called by anyone._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| offset | uint256 | The number of skipped elements. |
| limit | uint256 | The number of items requested. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| ordersIds | uint256[] | An array of active order IDs. |

### addTokensToWhitelist

```solidity
function addTokensToWhitelist(address[] tokens) external
```

Adds multiple tokens to the whitelist.

_Only callable by an address with the ADMIN_ROLE.
Requires each token address to be non-zero and not already in the whitelist.
Emits a {TokenAdded} event for each token added to the whitelist._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokens | address[] | An array of token addresses to add. |

### removeTokensFromWhitelist

```solidity
function removeTokensFromWhitelist(address[] tokens) external
```

Removes multiple tokens from the whitelist.

_Only callable by an address with the ADMIN_ROLE.
Removes each token address from the whitelist if it exists.
Emits a {TokenRemoved} event for each token removed from the whitelist._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokens | address[] | An array of token addresses to remove. |

### createOrder

```solidity
function createOrder(struct TradingPlatform.Order order) external returns (uint256)
```

Creates a new order.

_Requires various checks for the validity of the order.
Transfers base tokens from the user to this contract if user balance on contract is insufficient.
Adds the order to the active orders list and associates it with the user.
Emits a {OrderCreated} event upon successful creation of the order._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| order | struct TradingPlatform.Order | The order to create. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The ID of the created order. |

### deposit

```solidity
function deposit(address token, uint256 amount) external returns (bool)
```

Deposits an amount of tokens into the contract for a specific user.

_Requires the token to be allowed in the whitelist.
Transfers the specified amount of tokens from the user to this contract.
Updates the user's token balance in the contract.
Emits a {Deposited} event upon successful deposit._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of the token to deposit. |
| amount | uint256 | The amount of tokens to deposit. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | A boolean indicating the success of the deposit. |

### withdraw

```solidity
function withdraw(address token, uint256 amount) external returns (bool)
```

Withdraws an amount of tokens from the contract for a specific user.

_Requires the user to have a sufficient balance of the specified token.
Transfers the specified amount of tokens from the contract to the user.
Updates the user's token balance in the contract.
Emits a {Withdrawed} event upon successful withdrawal._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of the token to withdraw. |
| amount | uint256 | The amount of tokens to withdraw. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | A boolean indicating the success of the withdrawal. |

### boundOrders

```solidity
function boundOrders(uint256 leftOrderId, uint256 rightOrderId) external
```

Binds two orders together.

_Requires both orders to belong to the calling user and not be DCA orders.
Requires both orders to not be already bound with other orders.
Updates the boundOrder field of each order to bind them together.
Emits a {OrdersBounded} event upon successful binding of the orders._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| leftOrderId | uint256 | The ID of the left order to bind. |
| rightOrderId | uint256 | The ID of the right order to bind. |

### shouldRebalance

```solidity
function shouldRebalance() public view returns (uint256[])
```

Retrieves the list of order IDs that need to be rebalanced.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256[] | An array of order IDs that require rebalance. |

### checkUpkeep

```solidity
function checkUpkeep(bytes checkData) external view returns (bool upkeepNeeded, bytes performData)
```

Checks the upkeep status and provides the necessary data for performing upkeep.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| checkData | bytes | Unused parameter. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| upkeepNeeded | bool | A boolean indicating whether upkeep is needed or not. |
| performData | bytes | Encoded data containing the order IDs that require rebalance. |

### performUpkeep

```solidity
function performUpkeep(bytes performData) external
```

Performs the upkeep based on the provided performData.

_Requires the performData does contain any order IDs.
Emits a {OrderExecuted} event for each executed order._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| performData | bytes | Encoded data containing the order IDs to be executed. |

### executeOrders

```solidity
function executeOrders(uint256[] ordersIds) public returns (bool)
```

Executes the orders specified by the given order IDs.

_Emits a {OrderExecuted} event for each executed order._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| ordersIds | uint256[] | An array of order IDs to be executed. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | A boolean value indicating the success of the execution. |

### executeOrder

```solidity
function executeOrder(uint256 orderId) internal
```

Executes an individual order based on the provided order ID.

_This function is internal and should not be called directly from outside the contract.
Emits a {OrderExecuted} event._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| orderId | uint256 | ID of the order to be executed. |

### cancelOrders

```solidity
function cancelOrders(uint256[] ordersIds) external
```

Cancels the specified orders.

_Requires the orders to be active and belong to the calling user.
Refunds the base tokens to the user balance.
Emits a {OrderCanceled} event for each canceled order._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| ordersIds | uint256[] | Array of order IDs to be canceled. |

### checkOrder

```solidity
function checkOrder(uint256 orderId) public view returns (bool)
```

Checks if an order is valid and can be executed.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| orderId | uint256 | The ID of the order to be checked. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool True if the order is valid and can be executed, false otherwise. |

### calculateFee

```solidity
function calculateFee(uint256 amount) public view returns (uint256)
```

Calculates the fee amount based on the given token amount.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The token amount for which the fee is calculated. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 The calculated fee amount. |

### getPercent

```solidity
function getPercent(uint256 amount, uint24 percent) internal pure returns (uint256)
```

Calculates the percentage of an amount.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The base amount. |
| percent | uint24 | The percentage value, represented as a decimal with 6 digits precision. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 The calculated percentage amount. |

## IERC20WithDecimals

_Interface of the ERC20 standard as defined in the EIP._

### decimals

```solidity
function decimals() external view returns (uint8)
```

## ISwapHelperUniswapV3

### SecondsAgoDefaultUpdated

```solidity
event SecondsAgoDefaultUpdated(uint32 value)
```

Emitted when seconds ago default updated

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint32 | The new param secondsAgoDefault |

### SlippageUpdated

```solidity
event SlippageUpdated(uint256 value)
```

Emitted when slippage updated

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | The new slippage value, where 100% = 1000000 |

### Swapped

```solidity
event Swapped(address beneficiary, address tokenIn, address tokenOut, uint128 amountIn, uint256 amountOut)
```

Emitted when swap confirmed

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| beneficiary | address | Beneficiary output tokens after swap |
| tokenIn | address | Exchangeable token |
| tokenOut | address | The other of the two tokens in the desired pool |
| amountIn | uint128 | The desired number of tokens for the exchange |
| amountOut | uint256 | Average number of tokens `amountOut` in the selected time interval from the current moment and the pool |

### getAmountOut

```solidity
function getAmountOut(address tokenIn, address tokenOut, uint128 amountIn, uint24 fee, uint32 secondsAgo) external view returns (uint256 amountOut)
```

Get the minimum number of tokens for a subsequent swap, taking into account slippage

_tokenIn and tokenOut may be passed in either order: token0/token1 or token1/token0.
The call will revert if the pool not already exists, the fee is invalid, or the token arguments
are invalid. The minimum price is determined by a globally set parameter `_slippage`_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIn | address | One of the two tokens in the desired pool |
| tokenOut | address | The other of the two tokens in the desired pool |
| amountIn | uint128 | The desired number of tokens for the exchange |
| fee | uint24 | The desired fee for the pool |
| secondsAgo | uint32 | The number of seconds from the current moment to calculate the average price |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | Average number of tokens `amountOut` in the selected time interval from the current moment and the pool |

### swap

```solidity
function swap(address beneficiary, address tokenIn, address tokenOut, uint128 amountIn, uint24 fee) external returns (uint256 amountOut)
```

Swaps `amountIn` of one token for as much as possible of another along the specified path

_tokenIn and tokenOut may be passed in either order: token0/token1 or token1/token0.
The call will revert if the pool not already exists, the fee is invalid, or the token arguments
are invalid. The minimum price is determined by a globally set parameter `_slippage`_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| beneficiary | address | Beneficiary `amountOut` after swap |
| tokenIn | address | Exchangeable token |
| tokenOut | address | Output token during the exchange |
| amountIn | uint128 | The desired number of tokens for the exchange |
| fee | uint24 | The desired fee for the pool |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The number of tokens at the exit after the swap |

## ITradingPlatform

## IWETH

### deposit

```solidity
function deposit() external payable
```

### withdraw

```solidity
function withdraw(uint256) external
```

## SwapHelperUniswapV3

### ADMIN_ROLE

```solidity
bytes32 ADMIN_ROLE
```

### SWAPPER_ROLE

```solidity
bytes32 SWAPPER_ROLE
```

### PRECISION

```solidity
uint256 PRECISION
```

### swapRouter

```solidity
contract ISwapRouter swapRouter
```

### factory

```solidity
contract IUniswapV3Factory factory
```

### getAmountOut

```solidity
function getAmountOut(address tokenIn, address tokenOut, uint128 amountIn, uint24 fee, uint32 secondsAgo) public view returns (uint256 amountOut)
```

_See {ISwapHelperV3}_

### sortTokens

```solidity
function sortTokens(address tokenA, address tokenB) external pure returns (address token0, address token1)
```

### secondsAgoDefault

```solidity
function secondsAgoDefault() external view returns (uint256)
```

Returns a seconds ago default param

### slippage

```solidity
function slippage() external view returns (uint256)
```

Returns a slippage for calculate price

### constructor

```solidity
constructor(address swapRouter_, address factory_, uint256 slippage_, uint32 secondsAgoDefault_) public
```

Creates an instance of a contract that allows you to do
a single swap on smart contracts UniswapV3 and sends an `outputToken` to the address

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| swapRouter_ | address | Swap router address for exchange |
| factory_ | address | Factory address |
| slippage_ | uint256 | Maximum slippage for swap |
| secondsAgoDefault_ | uint32 | Number of seconds from the current time to query the average price for the period |

### swap

```solidity
function swap(address beneficiary, address tokenIn, address tokenOut, uint128 amountIn, uint24 fee) external returns (uint256 amountOut)
```

_See {ISwapHelperV3}_

### swapWithCustomSlippage

```solidity
function swapWithCustomSlippage(address beneficiary, address tokenIn, address tokenOut, uint128 amountIn, uint24 fee, uint256 slippageForSwap) external returns (uint256 amountOut)
```

_See {ISwapHelperV3}_

### updateSecondsAgoDefault

```solidity
function updateSecondsAgoDefault(uint32 value) external returns (bool)
```

Update secondsAgoDefault param responsible for the number of
seconds since the current moment to query the average price value (100% = 1000000)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint32 | Number of seconds |

### updateSlippage

```solidity
function updateSlippage(uint256 value) external returns (bool)
```

Update slippage for calculate minimum price swap

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | Number of seconds |

### onlyRole

```solidity
modifier onlyRole(bytes32 role)
```

Modifier to check different roles

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| role | bytes32 | Role `bytes32` to check availability for user |

