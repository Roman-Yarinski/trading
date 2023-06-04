import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { standardPrepare } from "@test-utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, TradingPlatform } from "@contracts";
import { BigNumber, ContractTransaction } from "ethers";

const baseAmount = ethers.utils.parseUnits("100");

// 0x000000000000000000000000000000000000000000000000000000000000003c0000000000000000000000000000000000000000000000000de0b6b3a7640000
// 0x0000000000000000000000000000000000000000000000056bc75e2d631000000000000000000000000000000000000000000000000000015af1d78b58c40000000000000000000000000000000000000000000000000000000000000000c350;

// describe.only("Coding", () => {
//   it("should calculate data for TRAILING", () => {
//     const baseAmountForTRAILING = "1000000000000000000000";
//     const amountToSpendForPeriod = ethers.utils.parseUnits("100");
//     const step = 50000; // 5%

//     const data = ethers.utils.defaultAbiCoder.encode(
//       ["uint128", "uint128", "uint24"],
//       [baseAmountForTRAILING, amountToSpendForPeriod, step]
//     );

//     console.log(data);
//   });

//   it("should calculate data for DCA", () => {
//     const amountToSpendForPeriod = ethers.utils.parseUnits("1000");
//     const period = 604800;

//     const data = ethers.utils.defaultAbiCoder.encode(
//       ["uint128", "uint128"],
//       [period, amountToSpendForPeriod]
//     );

//     console.log(data);
//   });

//   it("should decode data for DCA", () => {
//     const encodedData =
//       "0x000000000000000000000000000000000000000000000000000000000000003c0000000000000000000000000000000000000000000000000de0b6b3a7640000";

//     const data = ethers.utils.defaultAbiCoder.decode(["uint128", "uint128"], encodedData);

//     console.log(data);
//   });

//   it("should decode data for TRAILING", () => {
//     const encodedData =
//       "0x0000000000000000000000000000000000000000000000056bc75e2d631000000000000000000000000000000000000000000000000000015af1d78b58c40000000000000000000000000000000000000000000000000000000000000000c350";

//     const data = ethers.utils.defaultAbiCoder.decode(["uint128", "uint128", "uint24"], encodedData);

//     console.log(data);
//   });
// });

describe("Method: withdraw", () => {
  async function deployTradingPlatform() {
    const [deployer, admin] = await ethers.getSigners();
    const standardParams = await standardPrepare(deployer, admin);
    await standardParams.baseToken.approve(standardParams.tradingPlatform.address, baseAmount);
    await standardParams.tradingPlatform.deposit(standardParams.baseToken.address, baseAmount);

    return standardParams;
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
    let deployer: SignerWithAddress;
    let tradingPlatform: TradingPlatform;
    let baseToken: MockERC20;
    let userBalanceBefore: BigNumber;
    let withdrawAmount: BigNumber;

    before(async () => {
      const deploy = await loadFixture(deployTradingPlatform);
      deployer = deploy.deployer;
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
