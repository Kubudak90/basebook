// Base Sepolia Contract Addresses - New Deployment Dec 20, 2024
export const CONTRACTS = {
  LBFactory: "0x1aF4454bdcE78b2D130b4CD8fcd867195b7a2D1B",
  LBRouter: "0xFF9a6f598CaD576E45c44d2238CFF785CE089433",
  LBQuoter: "0xDE43cABB9F8a2e4B79059f72748EcacF8Eef0df5",
  LBPairImplementation: "0x7B3d501f0FA7c63e65c4aABEaa9a967841CC1b5E",
} as const

// Base Sepolia Chain Config
export const BASE_SEPOLIA_CHAIN = {
  id: 84532,
  name: "Base Sepolia",
  network: "base-sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["https://sepolia.base.org"] },
    public: { http: ["https://sepolia.base.org"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
  testnet: true,
} as const

// Common tokens on Base Sepolia (update with actual addresses)
export const TOKENS = {
  WETH: {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    logoURI: "https://replicate.delivery/xezq/2J01xSLI7VJCPJH6DSgpejYVgtqGKEeDyxpQGNHfrbGiI1hrA/tmph8d7rrpi.jpeg",
  },
  USDC: {
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://replicate.delivery/xezq/QkgN0zPMptLeACCeBMLt3SCWTrj2Fpa1ImGt7eXQceEJRqDXB/tmp8_vhyz3r.jpeg",
  },
  EURC: {
    address: "0x808456652fdb597867f38412077A9182bf77359F",
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/26045/standard/euro-coin.png",
  },
} as const
