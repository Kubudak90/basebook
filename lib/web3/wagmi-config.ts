"use client"

import { createConfig, http } from "@wagmi/core"
import { base, baseSepolia } from "@wagmi/core/chains"
import { coinbaseWallet, injected, walletConnect } from "@wagmi/connectors"

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id"

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "BaseBook",
      preference: "smartWalletOnly",
    }),
    walletConnect({ projectId }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
})
