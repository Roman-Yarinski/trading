import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, ContractTransaction, ContractInterface, BytesLike } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, TradingPlatform } from "@contracts";
import { ZERO_ADDRESS } from "@test-utils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from "@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json";
import {
  abi as ROUTER_ABI,
  bytecode as ROUTER_BYTECODE,
} from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json";

const SECONDS_AGO = BigNumber.from(60);
const PAIR_FEE = 5000;
const SLIPPAGE = BigNumber.from(10000); // 1% (100% = 1000000)

const totalSupply = ethers.utils.parseUnits("1000");
const baseAmount = ethers.utils.parseUnits("100");

enum Action {
  LOSS,
  PROFIT,
  DCA,
  MOVING_PROFIT,
}

describe("Method: createOrder", () => {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;

  async function deployTradingPlatform() {
    [deployer, admin] = await ethers.getSigners();

    const FactoryInstance = new ethers.ContractFactory(
      FACTORY_ABI as ContractInterface,
      FACTORY_BYTECODE as BytesLike
    );
    const RouterInstance = new ethers.ContractFactory(
      ROUTER_ABI as ContractInterface,
      ROUTER_BYTECODE as BytesLike
    );
    const TokenInstance = await ethers.getContractFactory("MockERC20");
    const WEthInstance = await ethers.getContractFactory("MockWETH");
    const TradingPlatformInstance = await ethers.getContractFactory("TradingPlatform");
    const SwapHelperV3Instance = await ethers.getContractFactory("SwapHelperUniswapV3");

    const factory = await FactoryInstance.connect(deployer).deploy();

    const WETH = await WEthInstance.connect(deployer).deploy();
    const router = await RouterInstance.connect(deployer).deploy(factory.address, WETH.address);

    const swapHelperContract = await SwapHelperV3Instance.connect(deployer).deploy(
      router.address,
      factory.address,
      SLIPPAGE,
      SECONDS_AGO
    );

    const baseToken = await TokenInstance.deploy(18, totalSupply);
    const targetToken = await TokenInstance.deploy(18, totalSupply);
    const randomToken = await TokenInstance.deploy(18, totalSupply);

    const tradingPlatform = await TradingPlatformInstance.deploy(swapHelperContract.address, admin.address);
    await tradingPlatform.connect(admin).addTokensToWhitelist([baseToken.address, targetToken.address]);
    await baseToken.approve(tradingPlatform.address, baseAmount);

    const adminRole = await swapHelperContract.ADMIN_ROLE();
    await swapHelperContract.grantRole(adminRole, admin.address);

    const order: TradingPlatform.OrderStruct = {
      userAddress: deployer.address,
      baseToken: baseToken.address,
      targetToken: targetToken.address,
      pairFee: PAIR_FEE,
      slippage: SLIPPAGE,
      baseAmount: baseAmount,
      aimTargetTokenAmount: ethers.utils.parseUnits("50"),
      minTargetTokenAmount: ethers.utils.parseUnits("45"),
      expiration: Math.floor(Date.now() / 1000) + 60 * 60,
      boundOrders: [],
      action: Action.LOSS,
    };

    return {
      swapHelperContract,
      tradingPlatform,
      factory,
      router,
      order,
      randomToken,
      baseToken,
      targetToken,
    };
  }

  describe("When one of parameters is incorrect", () => {
    it("When baseToken is zero address", async () => {
      const { tradingPlatform, order } = await loadFixture(deployTradingPlatform);
      const wrongOrder = { ...order };
      wrongOrder.baseToken = ZERO_ADDRESS;
      await expect(tradingPlatform.createOrder(wrongOrder)).to.be.revertedWith("Zero address check");
    });

    it("When targetToken is zero address", async () => {
      const { tradingPlatform, order } = await loadFixture(deployTradingPlatform);
      const wrongOrder = { ...order };
      wrongOrder.targetToken = ZERO_ADDRESS;
      await expect(tradingPlatform.createOrder(wrongOrder)).to.be.revertedWith("Zero address check");
    });

    it("When baseToken is equal targetToken", async () => {
      const { tradingPlatform, order } = await loadFixture(deployTradingPlatform);
      const wrongOrder = { ...order };
      wrongOrder.baseToken = order.targetToken;
      await expect(tradingPlatform.createOrder(wrongOrder)).to.be.revertedWith("Tokens must be different");
    });

    it("When baseToken amount is zero", async () => {
      const { tradingPlatform, order } = await loadFixture(deployTradingPlatform);
      const wrongOrder = { ...order };
      wrongOrder.baseAmount = 0;
      await expect(tradingPlatform.createOrder(wrongOrder)).to.be.revertedWith(
        "Amount in must be greater than 0"
      );
    });

    it("When slippage is zero", async () => {
      const { tradingPlatform, order } = await loadFixture(deployTradingPlatform);
      const wrongOrder = { ...order };
      wrongOrder.slippage = 0;
      await expect(tradingPlatform.createOrder(wrongOrder)).to.be.revertedWith("Unsafe slippage");
    });

    it("When aimTargetTokenAmount is zero", async () => {
      const { tradingPlatform, order } = await loadFixture(deployTradingPlatform);
      const wrongOrder = { ...order };
      wrongOrder.aimTargetTokenAmount = 0;
      await expect(tradingPlatform.createOrder(wrongOrder)).to.be.revertedWith(
        "Aim amount must be greater than 0"
      );
    });

    it("When expiration is lt time now", async () => {
      const { tradingPlatform, order } = await loadFixture(deployTradingPlatform);
      const wrongOrder = { ...order };
      wrongOrder.expiration = Math.floor(Date.now() / 1000) - 10;
      await expect(tradingPlatform.createOrder(wrongOrder)).to.be.revertedWith("Wrong expiration date");
    });

    it("When baseToken is not allowed", async () => {
      const { tradingPlatform, order, randomToken } = await loadFixture(deployTradingPlatform);
      const wrongOrder = { ...order };
      wrongOrder.baseToken = randomToken.address;
      await expect(tradingPlatform.createOrder(wrongOrder)).to.be.revertedWith("Token not allowed");
    });

    it("When targetToken is not allowed", async () => {
      const { tradingPlatform, order, randomToken } = await loadFixture(deployTradingPlatform);
      const wrongOrder = { ...order };
      wrongOrder.targetToken = randomToken.address;
      await expect(tradingPlatform.createOrder(wrongOrder)).to.be.revertedWith("Token not allowed");
    });
  });

  describe("When all parameters correct", () => {
    let result: ContractTransaction;
    let tradingPlatform: TradingPlatform;
    let baseToken: MockERC20;
    let order: TradingPlatform.OrderStruct;
    let orderIdBefore: BigNumber;
    let orderId: BigNumber;
    let activeOrdersLengthBefore: BigNumber;

    before(async () => {
      const deploy = await loadFixture(deployTradingPlatform);
      tradingPlatform = deploy.tradingPlatform;
      order = deploy.order;
      baseToken = deploy.baseToken;
      orderIdBefore = await tradingPlatform.getOrderCounter();
      activeOrdersLengthBefore = await tradingPlatform.activeOrdersLength();
      result = await tradingPlatform.createOrder(order);
      orderId = await tradingPlatform.getOrderCounter();
    });

    it("should not reverted", async () => {
      await expect(result).to.be.not.reverted;
    });

    it("should increment order id", () => {
      expect(orderIdBefore.add(1)).to.be.eq(orderId);
    });

    it("should add new order to active list", async () => {
      const orderStatus = await tradingPlatform.isActiveOrderExist(orderId);
      expect(orderStatus).to.be.true;
    });

    it("should increment active list", async () => {
      const activeOrdersLength = await tradingPlatform.activeOrdersLength();
      expect(activeOrdersLength).to.be.eq(activeOrdersLengthBefore.add(1));
    });

    it("should add expected order id to active list", async () => {
      const activeOrderId = await tradingPlatform.activeOrderId(0);
      expect(activeOrderId).to.be.eq(orderId);
    });

    it("should order list be equal to expected", async () => {
      const orderStatus = await tradingPlatform.activeOrdersIds(0, 10);
      expect(orderStatus).to.be.deep.eq([1]);
    });

    it("should userAddress be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["userAddress"]).to.be.eq(order.userAddress);
    });

    it("should baseToken be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["baseToken"]).to.be.eq(order.baseToken);
    });

    it("should targetToken be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["targetToken"]).to.be.eq(order.targetToken);
    });

    it("should pairFee be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["pairFee"]).to.be.eq(order.pairFee);
    });

    it("should slippage be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["slippage"]).to.be.eq(order.slippage);
    });

    it("should baseAmount be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["baseAmount"]).to.be.eq(order.baseAmount);
    });

    it("should aimTargetTokenAmount be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["aimTargetTokenAmount"]).to.be.eq(order.aimTargetTokenAmount);
    });

    it("should minTargetTokenAmount be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["minTargetTokenAmount"]).to.be.eq(order.minTargetTokenAmount);
    });

    it("should expiration be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["expiration"]).to.be.eq(order.expiration);
    });

    it("should boundOrders be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["boundOrders"]).to.be.deep.eq(order.boundOrders);
    });

    it("should baseAmount be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["action"]).to.be.eq(order.action);
    });

    it("should send tokens from user to trading contract", async () => {
      await expect(result).to.changeTokenBalances(
        baseToken,
        [deployer, tradingPlatform.address],
        [`-${order.baseAmount}`, order.baseAmount]
      );
    });

    it("should emit OrderCreated event", async () => {
      await expect(result).to.emit(tradingPlatform, "OrderCreated").withArgs(orderId, deployer.address);
    });
  });
});
