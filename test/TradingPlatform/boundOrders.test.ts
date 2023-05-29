import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { TradingPlatform } from "@contracts";
import { ContractTransaction } from "ethers";
import { baseAmount, Action, standardPrepare, createOrder } from "@test-utils";

describe("Method: boundOrders", () => {
  async function deployTradingPlatform() {
    const [deployer, admin, user] = await ethers.getSigners();

    const standardParams = await standardPrepare(deployer, admin);
    await standardParams.baseToken.transfer(user.address, baseAmount);

    await createOrder(
      deployer,
      standardParams.tradingPlatform,
      standardParams.baseToken,
      standardParams.targetToken,
      baseAmount,
      ethers.utils.parseUnits("50"),
      ethers.utils.parseUnits("45"),
      Action.PROFIT
    );
    await createOrder(
      deployer,
      standardParams.tradingPlatform,
      standardParams.baseToken,
      standardParams.targetToken,
      baseAmount,
      ethers.utils.parseUnits("50"),
      ethers.utils.parseUnits("45"),
      Action.PROFIT
    );
    await createOrder(
      deployer,
      standardParams.tradingPlatform,
      standardParams.baseToken,
      standardParams.targetToken,
      baseAmount,
      ethers.utils.parseUnits("50"),
      ethers.utils.parseUnits("45"),
      Action.PROFIT
    );
    await createOrder(
      user,
      standardParams.tradingPlatform,
      standardParams.baseToken,
      standardParams.targetToken,
      baseAmount,
      ethers.utils.parseUnits("50"),
      ethers.utils.parseUnits("45"),
      Action.PROFIT
    );

    return standardParams;
  }

  describe("When one of parameters is incorrect", () => {
    it("When input arrays have different length", async () => {
      const { tradingPlatform } = await loadFixture(deployTradingPlatform);
      await expect(tradingPlatform.boundOrders([1], [1, 2])).to.be.revertedWith("Non-compatible lists");
    });

    it("When try bound not your order", async () => {
      const { tradingPlatform } = await loadFixture(deployTradingPlatform);
      await expect(tradingPlatform.boundOrders([4], [1])).to.be.revertedWith("Not your order");
    });

    it("When try bound with not your order", async () => {
      const { tradingPlatform } = await loadFixture(deployTradingPlatform);
      await expect(tradingPlatform.boundOrders([1], [4])).to.be.revertedWith("Not your order");
    });

    it("When try bound non executing order", async () => {
      const { tradingPlatform } = await loadFixture(deployTradingPlatform);
      await expect(tradingPlatform.boundOrders([100], [1])).to.be.revertedWith("Not your order");
      await expect(tradingPlatform.boundOrders([1], [100])).to.be.revertedWith("Not your order");
    });

    it("When try bound an order to yourself", async () => {
      const { tradingPlatform } = await loadFixture(deployTradingPlatform);
      await expect(tradingPlatform.boundOrders([1], [1])).to.be.revertedWith(
        "Can't bound an order to yourself"
      );
    });
  });

  describe("When all parameters correct", () => {
    let result: ContractTransaction;
    let tradingPlatform: TradingPlatform;

    before(async () => {
      const deploy = await loadFixture(deployTradingPlatform);
      tradingPlatform = deploy.tradingPlatform;
      result = await tradingPlatform.boundOrders([1, 3], [2, 1]);
    });

    it("should not reverted", async () => {
      await expect(result).to.be.not.reverted;
    });

    it("should bound orders", async () => {
      const orderOne = await tradingPlatform.getOrdersInfo([1]);
      const orderTwo = await tradingPlatform.getOrdersInfo([2]);
      const orderThree = await tradingPlatform.getOrdersInfo([3]);
      const orderFour = await tradingPlatform.getOrdersInfo([4]);

      expect(orderOne[0].order["boundOrders"]).to.be.deep.eq([2, 3]);
      expect(orderTwo[0].order["boundOrders"]).to.be.deep.eq([1]);
      expect(orderThree[0].order["boundOrders"]).to.be.deep.eq([1]);
      expect(orderFour[0].order["boundOrders"]).to.be.deep.eq([]);
    });

    it("should emit OrdersBounded event", async () => {
      await expect(result).to.emit(tradingPlatform, "OrdersBounded").withArgs([1, 3], [2, 1]);
    });
  });
});
