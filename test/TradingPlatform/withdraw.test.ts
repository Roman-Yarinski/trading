import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, ContractInterface, BytesLike, ContractTransaction } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, TradingPlatform } from "@contracts";
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
const SLIPPAGE = BigNumber.from(10000); // 1% (100% = 1000000)

const totalSupply = ethers.utils.parseUnits("1000");
const baseAmount = ethers.utils.parseUnits("100");

describe("Method: withdraw", () => {
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

    const adminRole = await swapHelperContract.ADMIN_ROLE();
    await swapHelperContract.grantRole(adminRole, admin.address);
    await baseToken.approve(tradingPlatform.address, totalSupply);
    await tradingPlatform.deposit(baseToken.address, baseAmount);

    return {
      swapHelperContract,
      tradingPlatform,
      factory,
      router,
      randomToken,
      baseToken,
      targetToken,
    };
  }

  describe("When one of parameters is incorrect", () => {
    it("When amount exceed balance", async () => {
      const { tradingPlatform, baseToken } = await loadFixture(deployTradingPlatform);
      await expect(tradingPlatform.withdraw(baseToken.address, baseAmount.add(1))).to.be.revertedWith(
        "Amount exceed balance"
      );
    });
  });

  describe("When all parameters correct", () => {
    let result: ContractTransaction;
    let tradingPlatform: TradingPlatform;
    let baseToken: MockERC20;
    let userBalanceBefore: BigNumber;
    let withdrawAmount: BigNumber;

    before(async () => {
      const deploy = await loadFixture(deployTradingPlatform);
      tradingPlatform = deploy.tradingPlatform;
      baseToken = deploy.baseToken;
      userBalanceBefore = await tradingPlatform.getUserBalance(deployer.address, baseToken.address);
      withdrawAmount = baseAmount.div(2);
      result = await tradingPlatform.withdraw(baseToken.address, baseAmount.div(2));
    });

    it("should not reverted", async () => {
      await expect(result).to.be.not.reverted;
    });

    it("should decrement user balance", async () => {
      const userBalance = await tradingPlatform.getUserBalance(deployer.address, baseToken.address);
      expect(userBalance).to.be.eq(userBalanceBefore.sub(withdrawAmount));
    });

    it("should send tokens from user to trading contract", async () => {
      await expect(result).to.changeTokenBalances(
        baseToken,
        [tradingPlatform.address, deployer],
        [`-${withdrawAmount}`, withdrawAmount]
      );
    });

    it("should emit Deposited event", async () => {
      await expect(result)
        .to.emit(tradingPlatform, "Withdrawed")
        .withArgs(deployer.address, baseToken.address, withdrawAmount);
    });
  });
});
