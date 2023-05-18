import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { ContractTransaction } from "ethers";
import { ERC20, IUniswapV3Pool, SwapHelperUniswapV3, TradingPlatform } from "@contracts";
import {
  Action,
  PAIR_FEE,
  PRECISION,
  baseAmount,
  createOrder,
  standardPrepare,
  calculateAmount0ToSale,
} from "@test-utils";

async function preparePairAndContracts() {
  const [deployer, admin] = await ethers.getSigners();

  return standardPrepare(deployer, admin);
}

describe("Method: executeOrders", () => {
  describe("Orders not exists", () => {
    it("should do nothing", async () => {
      const { tradingPlatform } = await loadFixture(preparePairAndContracts);

      const executeOrders = await tradingPlatform.executeOrders([1]);
      await expect(executeOrders).to.be.not.reverted;
    });
  });

  describe("Orders to execute", () => {
    it("should do nothing with empty array", async () => {
      const { tradingPlatform, deployer, baseToken, targetToken } = await loadFixture(
        preparePairAndContracts
      );

      const aimTargetTokenAmountOne = ethers.utils.parseUnits("2");
      const minTargetTokenAmountOne = ethers.utils.parseUnits("2");
      const aimTargetTokenAmountTwo = ethers.utils.parseUnits("10");
      const minTargetTokenAmountTwo = ethers.utils.parseUnits("10");
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountOne,
        minTargetTokenAmountOne,
        Action.PROFIT
      );
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountTwo,
        minTargetTokenAmountTwo,
        Action.PROFIT
      );
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountTwo,
        minTargetTokenAmountTwo,
        Action.LOSS
      );
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountTwo,
        minTargetTokenAmountTwo,
        Action.LOSS
      );

      const checkStatusOrderOne = await tradingPlatform.checkOrder(1);
      const checkStatusOrderTwo = await tradingPlatform.checkOrder(2);
      const checkStatusOrderThree = await tradingPlatform.checkOrder(3);
      const checkStatusOrderFour = await tradingPlatform.checkOrder(4);

      expect(checkStatusOrderOne).to.be.false;
      expect(checkStatusOrderTwo).to.be.false;
      expect(checkStatusOrderThree).to.be.false;
      expect(checkStatusOrderFour).to.be.false;

      const rebalanceArray = await tradingPlatform.shouldRebalance();
      const executeOrders = await tradingPlatform.executeOrders(rebalanceArray);

      expect(rebalanceArray).to.be.deep.eq([]);
      await expect(executeOrders).to.be.not.reverted;
    });

    it("should execute all ready orders and skip others", async () => {
      const { tradingPlatform, swapHelperContract, poolContract, deployer, baseToken, targetToken } =
        await loadFixture(preparePairAndContracts);

      await tradingPlatform.setProtocolFee(0); // skip fee influence

      const aimTargetTokenAmountProfitOne = ethers.utils.parseUnits("2");
      const minTargetTokenAmountProfitOne = ethers.utils.parseUnits("2");
      const aimTargetTokenAmountProfitTwo = ethers.utils.parseUnits("10");
      const minTargetTokenAmountProfitTwo = ethers.utils.parseUnits("10");
      const aimTargetTokenAmountLossOne = ethers.utils.parseUnits("5");
      const minTargetTokenAmountLossOne = ethers.utils.parseUnits("4");
      const aimTargetTokenAmountLossTwo = ethers.utils.parseUnits("3");
      const minTargetTokenAmountLossTwo = ethers.utils.parseUnits("2");

      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountProfitOne,
        minTargetTokenAmountProfitOne,
        Action.PROFIT
      );
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountProfitTwo,
        minTargetTokenAmountProfitTwo,
        Action.PROFIT
      );
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountLossOne,
        minTargetTokenAmountLossOne,
        Action.LOSS
      );
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountLossTwo,
        minTargetTokenAmountLossTwo,
        Action.LOSS
      );

      const amountToken0ToSale = await calculateAmount0ToSale(poolContract.address, 100, 201);
      await targetToken.approve(swapHelperContract.address, amountToken0ToSale.toString());
      await swapHelperContract.swapWithCustomSlippage(
        deployer.address,
        targetToken.address,
        baseToken.address,
        amountToken0ToSale.toString(),
        PAIR_FEE,
        PRECISION - 1 // 100% slippage for set new price on pair
      );

      await mine(10, { interval: 60 });

      const checkStatusOrderOne = await tradingPlatform.checkOrder(1);
      const checkStatusOrderTwo = await tradingPlatform.checkOrder(2);
      const checkStatusOrderThree = await tradingPlatform.checkOrder(3);
      const checkStatusOrderFour = await tradingPlatform.checkOrder(4);

      expect(checkStatusOrderOne).to.be.true;
      expect(checkStatusOrderTwo).to.be.false;
      expect(checkStatusOrderThree).to.be.false;
      expect(checkStatusOrderFour).to.be.true;

      let rebalanceArray = await tradingPlatform.shouldRebalance();
      expect(rebalanceArray).to.be.deep.eq([1, 4]);
      const randomRebalanceArray = [1, 2, 4, 1, 99, 3];

      await tradingPlatform.executeOrders(randomRebalanceArray);

      rebalanceArray = await tradingPlatform.shouldRebalance();
      expect(rebalanceArray).to.be.deep.eq([]);
    });

    it("should execute all ready orders", async () => {
      const { tradingPlatform, swapHelperContract, poolContract, deployer, baseToken, targetToken } =
        await loadFixture(preparePairAndContracts);

      const aimTargetTokenAmountProfitOne = ethers.utils.parseUnits("2");
      const aimTargetTokenAmountProfitTwo = ethers.utils.parseUnits("5");
      const aimTargetTokenAmountLossOne = ethers.utils.parseUnits("10");
      const aimTargetTokenAmountLossTwo = ethers.utils.parseUnits("6");
      const minTargetTokenAmountForAll = 0;

      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountProfitOne,
        minTargetTokenAmountForAll,
        Action.PROFIT
      );
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountProfitTwo,
        minTargetTokenAmountForAll,
        Action.PROFIT
      );
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountLossOne,
        minTargetTokenAmountForAll,
        Action.LOSS
      );
      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountLossTwo,
        minTargetTokenAmountForAll,
        Action.LOSS
      );

      const amountToken0ToSale = await calculateAmount0ToSale(poolContract.address, 100, 501);
      await targetToken.approve(swapHelperContract.address, amountToken0ToSale.toString());
      await swapHelperContract.swapWithCustomSlippage(
        deployer.address,
        targetToken.address,
        baseToken.address,
        amountToken0ToSale.toString(),
        PAIR_FEE,
        PRECISION - 1 // 100% slippage for set new price on pair
      );

      await mine(10, { interval: 60 });

      const checkStatusOrderOne = await tradingPlatform.checkOrder(1);
      const checkStatusOrderTwo = await tradingPlatform.checkOrder(2);
      const checkStatusOrderThree = await tradingPlatform.checkOrder(3);
      const checkStatusOrderFour = await tradingPlatform.checkOrder(4);

      expect(checkStatusOrderOne).to.be.true;
      expect(checkStatusOrderTwo).to.be.true;
      expect(checkStatusOrderThree).to.be.true;
      expect(checkStatusOrderFour).to.be.true;

      let rebalanceArray = await tradingPlatform.shouldRebalance();
      expect(rebalanceArray).to.be.deep.eq([1, 2, 3, 4]);

      await tradingPlatform.executeOrders(rebalanceArray);

      rebalanceArray = await tradingPlatform.shouldRebalance();
      expect(rebalanceArray).to.be.deep.eq([]);
    });
  });

  describe("When all parameters correct", () => {
    let result: ContractTransaction;
    let tradingPlatform: TradingPlatform;
    let swapHelperContract: SwapHelperUniswapV3;
    let poolContract: IUniswapV3Pool;
    let baseToken: ERC20;
    let targetToken: ERC20;
    let deployer: SignerWithAddress;
    const aimTargetTokenAmountProfit = ethers.utils.parseUnits("2");
    const minTargetTokenAmountProfit = ethers.utils.parseUnits("2");

    before(async () => {
      const deployments = await loadFixture(preparePairAndContracts);
      tradingPlatform = deployments.tradingPlatform;
      swapHelperContract = deployments.swapHelperContract;
      poolContract = deployments.poolContract;
      baseToken = deployments.baseToken;
      targetToken = deployments.targetToken;
      deployer = deployments.deployer;

      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountProfit,
        minTargetTokenAmountProfit,
        Action.PROFIT
      );

      await createOrder(
        deployer,
        tradingPlatform,
        baseToken,
        targetToken,
        baseAmount,
        aimTargetTokenAmountProfit,
        minTargetTokenAmountProfit,
        Action.PROFIT
      );

      await tradingPlatform.boundOrders([1, 2], [2, 1]);

      const amountToken0ToSale = await calculateAmount0ToSale(poolContract.address, 100, 501);
      await targetToken.approve(swapHelperContract.address, amountToken0ToSale.toString());
      await swapHelperContract.swapWithCustomSlippage(
        deployer.address,
        targetToken.address,
        baseToken.address,
        amountToken0ToSale.toString(),
        PAIR_FEE,
        PRECISION - 1 // 100% slippage for set new price on pair
      );

      await mine(10, { interval: 60 });

      result = await tradingPlatform.executeOrders([1]);
    });

    it("should not reverted", async () => {
      await expect(result).to.be.not.reverted;
    });

    it("should remove order from actives", async () => {
      const orderStatus = await tradingPlatform.isActiveOrderExist(1);
      expect(orderStatus).to.be.false;
    });

    it("should remove bound orders from actives", async () => {
      const orderStatus = await tradingPlatform.isActiveOrderExist(2);
      expect(orderStatus).to.be.false;
    });

    it("should remove orders from actives", async () => {
      const activeOrdersIds = await tradingPlatform.activeOrdersIds(0, 1000);
      expect(activeOrdersIds).to.be.deep.eq([]);
    });

    it("should increment fee balance", async () => {
      // TODO: fix fee check
      const feeRecipient = await tradingPlatform.getFeeRecipient();
      const feeRecipientBalance = await tradingPlatform.getUserBalance(feeRecipient, targetToken.address);
      expect(feeRecipientBalance).to.be.gte(0);
    });

    it("should increment user balance", async () => {
      const userBalance = await tradingPlatform.getUserBalance(deployer.address, targetToken.address);
      expect(userBalance).to.be.gte(minTargetTokenAmountProfit);
    });

    it("should emit OrderExecuted event", async () => {
      await expect(result).to.emit(tradingPlatform, "OrderExecuted").withArgs(1, deployer.address);
    });
  });
});
