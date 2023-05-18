import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractFactory } from "ethers";
import { SwapHelperUniswapV3, TradingPlatform } from "@contracts";
import { FACTORY, SWAP_ROUTER, SLIPPAGE, SECONDS_AGO, ZERO_ADDRESS, getSigner } from "@test-utils";

describe("Method: constructor", () => {
  let deployer: string;
  let admin: string;
  let swapHelperContract: SwapHelperUniswapV3;
  let TradingPlatformInstance: ContractFactory;
  let tradingPlatform: TradingPlatform;

  async function deploySwapHelperContract(
    deployerAddress: string,
    adminAddress: string,
    swapRouterAddress: string,
    factoryAddress: string,
    slippage: BigNumber,
    secondsAgo: BigNumber
  ): Promise<SwapHelperUniswapV3> {
    const deployerWallet = (await getSigner(deployerAddress)) as SignerWithAddress;

    TradingPlatformInstance = await ethers.getContractFactory("TradingPlatform");
    const SwapHelperV3Instance = await ethers.getContractFactory("SwapHelperUniswapV3");
    swapHelperContract = await SwapHelperV3Instance.connect(deployerWallet).deploy(
      swapRouterAddress,
      factoryAddress,
      slippage,
      secondsAgo
    );

    const adminRole = await swapHelperContract.ADMIN_ROLE();

    await swapHelperContract.grantRole(adminRole, adminAddress);

    return swapHelperContract;
  }

  before(async () => {
    [deployer, admin] = (await ethers.getSigners()).map((account) => account.address);

    swapHelperContract = await deploySwapHelperContract(
      deployer,
      admin,
      SWAP_ROUTER,
      FACTORY,
      SLIPPAGE,
      SECONDS_AGO
    );
  });

  describe("When one of parameters is incorrect", () => {
    it("When swapRouter is zero address", async () => {
      await expect(TradingPlatformInstance.deploy(ZERO_ADDRESS, admin)).to.be.revertedWith(
        "UniswapHelperV3 zero address"
      );
    });

    it("When admin is zero address", async () => {
      await expect(
        TradingPlatformInstance.deploy(swapHelperContract.address, ZERO_ADDRESS)
      ).to.be.revertedWith("Admin zero address");
    });
  });

  describe("When all parameters correct", () => {
    before(async () => {
      tradingPlatform = (await TradingPlatformInstance.deploy(
        swapHelperContract.address,
        admin
      )) as TradingPlatform;
    });

    it("should secondsAgo be equal to expected", async () => {
      expect(await tradingPlatform.getSwapHelper()).to.eq(swapHelperContract.address);
    });
  });
});
