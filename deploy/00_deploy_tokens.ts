import { DeployFunction } from "hardhat-deploy/types";
import { typedDeployments } from "@utils";
import { DEPLOY } from "config";

const migrate: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deploy } = typedDeployments(deployments);
  const { deployer } = await getNamedAccounts();
  const { TOKEN } = DEPLOY;

  await deploy("MockERC20", {
    from: deployer,
    args: [TOKEN.DECIMALS, TOKEN.SUPPLY],
    log: true,
  });
};

export default migrate;

migrate.tags = ["token", "test"];
