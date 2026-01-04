// Trader Joe v2 Liquidity Book ABIs
import { parseAbi } from "viem"

export const LBRouterABI = parseAbi([
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, uint256[] pairBinSteps, address[] tokenPath, address to, uint256 deadline) external returns (uint256 amountOut)",
  "function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, uint256[] pairBinSteps, address[] tokenPath, address to, uint256 deadline) external returns (uint256[] amountsIn)",
  "function getSwapIn(address lbPair, uint128 amountOut, bool swapForY) external view returns (uint128 amountIn, uint128 amountOutLeft, uint128 fee)",
  "function getSwapOut(address lbPair, uint128 amountIn, bool swapForY) external view returns (uint128 amountInLeft, uint128 amountOut, uint128 fee)",
  "function addLiquidity((address tokenX, address tokenY, uint256 binStep, uint256 amountX, uint256 amountY, uint256 amountXMin, uint256 amountYMin, uint256 activeIdDesired, uint256 idSlippage, int256[] deltaIds, uint256[] distributionX, uint256[] distributionY, address to, address refundTo, uint256 deadline) liquidityParameters) external returns (uint256 amountXAdded, uint256 amountYAdded, uint256 amountXLeft, uint256 amountYLeft, uint256[] depositIds, uint256[] liquidityMinted)",
  "function removeLiquidity(address tokenX, address tokenY, uint16 binStep, uint256 amountXMin, uint256 amountYMin, uint256[] ids, uint256[] amounts, address to, uint256 deadline) external returns (uint256 amountX, uint256 amountY)",
])

export const LBFactoryABI = parseAbi([
  "function getLBPairInformation(address tokenX, address tokenY, uint256 binStep) external view returns (address lbPair, uint256 binStepOverride, bool isOpen, bool ignoredForRouting, uint256 createdByOwner)",
  "function getAllLBPairs(address tokenX, address tokenY) external view returns ((uint16 binStep, address lbPair, bool createdByOwner, bool ignoredForRouting)[] lbPairsAvailable)",
  "function getPreset(uint16 binStep) external view returns (uint256 baseFactor, uint256 filterPeriod, uint256 decayPeriod, uint256 reductionFactor, uint256 variableFeeControl, uint256 protocolShare, uint256 maxVolatilityAccumulator, bool isOpen)",
  "function createLBPair(address tokenX, address tokenY, uint24 activeId, uint16 binStep) external returns (address pair)",
])

export const LBQuoterABI = parseAbi([
  "function findBestPathFromAmountIn(address[] route, uint128 amountIn) external view returns ((address[] route, uint256[] pairs, uint256[] binSteps, uint256[] amounts, uint256[] virtualAmountsWithoutSlippage, uint256[] fees) quote)",
  "function findBestPathFromAmountOut(address[] route, uint128 amountOut) external view returns ((address[] route, uint256[] pairs, uint256[] binSteps, uint256[] amounts, uint256[] virtualAmountsWithoutSlippage, uint256[] fees) quote)",
])

export const LBPairABI = parseAbi([
  "function getReservesAndId() external view returns (uint256 reserveX, uint256 reserveY, uint256 activeId)",
  "function getBin(uint24 id) external view returns (uint128 binReserveX, uint128 binReserveY)",
  "function getTokenX() external view returns (address)",
  "function getTokenY() external view returns (address)",
  "function getBinStep() external view returns (uint16)",
  "function getActiveId() external view returns (uint24)",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function balanceOfBatch(address[] accounts, uint256[] ids) external view returns (uint256[] balances)",
  "function totalSupply(uint256 id) external view returns (uint256)",
  // LBToken approval functions (TraderJoe V2 uses approveForAll, not setApprovalForAll)
  "function isApprovedForAll(address owner, address spender) external view returns (bool)",
  "function approveForAll(address spender, bool approved) external",
])

export const ERC20ABI = parseAbi([
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
])
