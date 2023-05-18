import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, TradingPlatform } from "@contracts";
import { BigNumber, ContractTransaction } from "ethers";
import { standardPrepare, PAIR_FEE, SLIPPAGE, Action, ZERO_ADDRESS } from "@test-utils";

const baseAmount = ethers.utils.parseUnits("100");

describe("Method: createOrder", () => {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;

  async function deployTradingPlatform() {
    [deployer, admin] = await ethers.getSigners();

    const standardParams = await standardPrepare(deployer, admin);

    const order: TradingPlatform.OrderStruct = {
      userAddress: deployer.address,
      baseToken: standardParams.baseToken.address,
      targetToken: standardParams.targetToken.address,
      pairFee: PAIR_FEE,
      slippage: SLIPPAGE,
      baseAmount: baseAmount,
      aimTargetTokenAmount: ethers.utils.parseUnits("50"),
      minTargetTokenAmount: ethers.utils.parseUnits("45"),
      expiration: Math.floor(Date.now() / 1000) + 60 * 60,
      boundOrders: [],
      action: Action.LOSS,
    };

    const orderWithBound: TradingPlatform.OrderStruct = {
      userAddress: deployer.address,
      baseToken: standardParams.baseToken.address,
      targetToken: standardParams.targetToken.address,
      pairFee: PAIR_FEE,
      slippage: SLIPPAGE,
      baseAmount: baseAmount,
      aimTargetTokenAmount: ethers.utils.parseUnits("50"),
      minTargetTokenAmount: ethers.utils.parseUnits("45"),
      expiration: Math.floor(Date.now() / 1000) + 60 * 60,
      boundOrders: [1],
      action: Action.LOSS,
    };

    return {
      ...standardParams,
      order,
      orderWithBound,
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
      wrongOrder.expiration = (await time.latest()) - 10;
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
    let orderWithBound: TradingPlatform.OrderStruct;
    let orderIdBefore: BigNumber;
    let orderId: BigNumber;
    let activeOrdersLengthBefore: BigNumber;

    before(async () => {
      const deploy = await loadFixture(deployTradingPlatform);
      tradingPlatform = deploy.tradingPlatform;
      order = deploy.order;
      baseToken = deploy.baseToken;
      orderWithBound = deploy.orderWithBound;
      await baseToken.approve(tradingPlatform.address, baseAmount.mul(2));
      await tradingPlatform.createOrder(order);
      activeOrdersLengthBefore = await tradingPlatform.activeOrdersLength();
      orderIdBefore = await tradingPlatform.getOrderCounter();
      result = await tradingPlatform.createOrder(orderWithBound);
      orderId = await tradingPlatform.getOrderCounter();
    });

    it("should not reverted", async () => {
      await expect(result).to.be.not.reverted;
    });

    it("should increment orderWithBound id", () => {
      expect(orderIdBefore.add(1)).to.be.eq(orderId);
    });

    it("should add new orderWithBound to active list", async () => {
      const orderStatus = await tradingPlatform.isActiveOrderExist(orderId);
      expect(orderStatus).to.be.true;
    });

    it("should increment active list", async () => {
      const activeOrdersLength = await tradingPlatform.activeOrdersLength();
      expect(activeOrdersLength).to.be.eq(activeOrdersLengthBefore.add(1));
    });

    it("should add expected orderWithBound id to active list", async () => {
      const activeOrderId = await tradingPlatform.activeOrderId(1);
      expect(activeOrderId).to.be.eq(orderId);
    });

    it("should orderWithBound list be equal to expected", async () => {
      const orderStatus = await tradingPlatform.activeOrdersIds(0, 10);
      expect(orderStatus).to.be.deep.eq([1, 2]);
    });

    it("should userAddress be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["userAddress"]).to.be.eq(orderWithBound.userAddress);
    });

    it("should baseToken be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["baseToken"]).to.be.eq(orderWithBound.baseToken);
    });

    it("should targetToken be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["targetToken"]).to.be.eq(orderWithBound.targetToken);
    });

    it("should pairFee be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["pairFee"]).to.be.eq(orderWithBound.pairFee);
    });

    it("should slippage be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["slippage"]).to.be.eq(orderWithBound.slippage);
    });

    it("should baseAmount be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["baseAmount"]).to.be.eq(orderWithBound.baseAmount);
    });

    it("should aimTargetTokenAmount be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["aimTargetTokenAmount"]).to.be.eq(orderWithBound.aimTargetTokenAmount);
    });

    it("should minTargetTokenAmount be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["minTargetTokenAmount"]).to.be.eq(orderWithBound.minTargetTokenAmount);
    });

    it("should expiration be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["expiration"]).to.be.eq(orderWithBound.expiration);
    });

    it("should boundOrders be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["boundOrders"]).to.be.deep.eq(orderWithBound.boundOrders);
    });

    it("should baseAmount be equal to expected", async () => {
      const orderInfo = await tradingPlatform.getOrderInfo(orderId);
      expect(orderInfo["action"]).to.be.eq(orderWithBound.action);
    });

    it("should send tokens from user to trading contract", async () => {
      await expect(result).to.changeTokenBalances(
        baseToken,
        [deployer, tradingPlatform.address],
        [`-${orderWithBound.baseAmount}`, orderWithBound.baseAmount]
      );
    });

    it("should emit OrderCreated event", async () => {
      await expect(result).to.emit(tradingPlatform, "OrderCreated").withArgs(orderId, deployer.address);
    });
  });
});
