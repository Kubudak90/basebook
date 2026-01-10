"use client"

import { SwapCard } from "@/components/swap/swap-card"
import { PoolPage } from "@/components/pools/pool-page"
import { LiquidityCard } from "@/components/liquidity/liquidity-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Droplets, Zap, Layers } from "lucide-react"
import { useState } from "react"
import { StarsBackground } from "@/components/animate-ui/components/backgrounds/stars"
import { useTheme } from "next-themes"

export default function Home() {
  const [activeTab, setActiveTab] = useState("pool")
  const { resolvedTheme } = useTheme()

  return (
    <div className="min-h-screen bg-background relative">
      {/* Very Subtle Stars Background */}
      <StarsBackground
        starColor={resolvedTheme === 'dark' ? '#666' : '#ddd'}
        className="absolute inset-0 -z-10 opacity-20"
        factor={0.015}
        speed={20}
      />

      {/* Header - Minimalist */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container max-w-5xl flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Droplets className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">BaseBook</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content - Centered & Minimal */}
      <main className="container max-w-2xl py-6 px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Compact Tabs */}
          <TabsList className="grid w-full grid-cols-3 h-11 mb-6">
            <TabsTrigger value="swap" className="text-sm">
              <Zap className="mr-1.5 h-4 w-4" />
              Swap
            </TabsTrigger>
            <TabsTrigger value="pool" className="text-sm">
              <Layers className="mr-1.5 h-4 w-4" />
              Pools
            </TabsTrigger>
            <TabsTrigger value="liquidity" className="text-sm">
              <Droplets className="mr-1.5 h-4 w-4" />
              Liquidity
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <TabsContent value="swap" className="mt-0">
            <SwapCard />
          </TabsContent>

          <TabsContent value="pool" className="mt-0">
            <PoolPage onNavigateToLiquidity={() => setActiveTab("liquidity")} />
          </TabsContent>

          <TabsContent value="liquidity" className="mt-0">
            <LiquidityCard />
          </TabsContent>
        </Tabs>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t mt-auto">
        <div className="container max-w-5xl py-4 px-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>BaseBook DEX on Base Sepolia</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span>Testnet</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
