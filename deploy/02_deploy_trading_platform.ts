import { DeployFunction } from "hardhat-deploy/types";
import { typedDeployments } from "@utils";
import { DEPLOY } from "config";

const migrate: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deploy, get } = typedDeployments(deployments);
  const { deployer } = await getNamedAccounts();
  const { TRADING_PLATFORM } = DEPLOY;

  const swapHelper = TRADING_PLATFORM.SWAP_HELPER || (await get("SwapHelperUniswapV3")).address;
  const admin = TRADING_PLATFORM.ADMIN || deployer;

  await deploy("TradingPlatform", {
    from: deployer,
    args: [swapHelper, admin],
    log: true,
  });
};

export default migrate;

migrate.tags = ["platform", "all"];
