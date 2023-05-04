import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, ContractTransaction, ContractInterface, BytesLike } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TradingPlatform } from "@contracts";
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

describe("Method: boundOrders", () => {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;

  async function deployTradingPlatform() {
    [deployer, admin, user] = await ethers.getSigners();

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
    await baseToken.mint(user.address, totalSupply);
    await baseToken.approve(tradingPlatform.address, totalSupply);
    await baseToken.connect(user).approve(tradingPlatform.address, totalSupply);

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

    await tradingPlatform.createOrder(order);
    await tradingPlatform.createOrder(order);
    await tradingPlatform.createOrder(order);
    const userOrder = { ...order };
    userOrder.userAddress = user.address;
    await tradingPlatform.connect(user).createOrder(userOrder);

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
      const orderOne = await tradingPlatform.getOrderInfo(1);
      const orderTwo = await tradingPlatform.getOrderInfo(2);
      const orderThree = await tradingPlatform.getOrderInfo(3);
      const orderFour = await tradingPlatform.getOrderInfo(4);

      expect(orderOne["boundOrders"]).to.be.deep.eq([2, 3]);
      expect(orderTwo["boundOrders"]).to.be.deep.eq([1]);
      expect(orderThree["boundOrders"]).to.be.deep.eq([1]);
      expect(orderFour["boundOrders"]).to.be.deep.eq([]);
    });

    it("should emit OrdersBounded event", async () => {
      await expect(result).to.emit(tradingPlatform, "OrdersBounded").withArgs([1, 3], [2, 1]);
    });
  });
});
