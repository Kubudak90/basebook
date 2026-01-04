"use client"

import { SwapCard } from "@/components/swap/swap-card"
import { PoolPage } from "@/components/pools/pool-page"
import { LiquidityCard } from "@/components/liquidity/liquidity-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Droplets, Zap, Network, Layers } from "lucide-react"
import { useState } from "react"

export default function Home() {
  const [activeTab, setActiveTab] = useState("pool")
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Droplets className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">BaseBook</h1>
              <p className="text-xs text-muted-foreground">Liquidity Book DEX</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="mx-auto space-y-6">
          {/* Main Interface */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 h-12">
              <TabsTrigger value="swap" className="text-base">
                <Zap className="mr-2 h-4 w-4" />
                Swap
              </TabsTrigger>
              <TabsTrigger value="pool" className="text-base">
                <Layers className="mr-2 h-4 w-4" />
                Pools
              </TabsTrigger>
              <TabsTrigger value="liquidity" className="text-base">
                <Droplets className="mr-2 h-4 w-4" />
                Liquidity
              </TabsTrigger>
            </TabsList>
            <TabsContent value="swap" className="mt-8">
              <div className="max-w-lg mx-auto">
                <SwapCard />
              </div>
            </TabsContent>
            <TabsContent value="pool" className="mt-8">
              <PoolPage onNavigateToLiquidity={() => setActiveTab("liquidity")} />
            </TabsContent>
            <TabsContent value="liquidity" className="mt-8">
              <LiquidityCard />
            </TabsContent>
          </Tabs>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            <div className="group p-6 rounded-xl border bg-card hover:shadow-lg transition-all hover:border-primary/50">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Droplets className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Liquidity Book</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Provide liquidity in discrete price bins for improved capital efficiency and reduced impermanent loss
              </p>
            </div>
            <div className="group p-6 rounded-xl border bg-card hover:shadow-lg transition-all hover:border-accent/50">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Dynamic Fees</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Adaptive fee structure that adjusts to market volatility, ensuring optimal returns for liquidity
                providers
              </p>
            </div>
            <div className="group p-6 rounded-xl border bg-card hover:shadow-lg transition-all hover:border-primary/50">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Base Network</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Built on Base Sepolia testnet for lightning-fast transactions with minimal gas fees
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-24 bg-muted/30">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>BaseBook - Powered by Trader Joe v2 Liquidity Book on Base Sepolia</p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>Base Sepolia Testnet</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
