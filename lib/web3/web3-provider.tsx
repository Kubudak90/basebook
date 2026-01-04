"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type Config } from "@wagmi/core"
import { WagmiProvider } from "wagmi"
import { wagmiConfig } from "./wagmi-config"
import { type ReactNode, useState } from "react"

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
