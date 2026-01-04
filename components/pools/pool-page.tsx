"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Search, Plus, RefreshCw, Loader2 } from "lucide-react"
import { PoolRow } from "./pool-row"
import { usePools } from "@/hooks/use-pools"
import { MyPools } from "@/components/my-pools"

interface PoolPageProps {
    onNavigateToLiquidity?: () => void
}

export function PoolPage({ onNavigateToLiquidity }: PoolPageProps = {}) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState("")
    const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null)

    const handleManagePool = (poolId: string) => {
        // Navigate to liquidity tab
        if (onNavigateToLiquidity) {
            onNavigateToLiquidity()
        }
    }

    const { pools, isLoading, error, refetch } = usePools()

    const filteredPools = pools.filter(
        (pool) =>
            pool.tokenX.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
            pool.tokenY.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalTVL = pools.reduce((sum, pool) => sum + pool.liquidity, 0)
    const totalVolume = pools.reduce((sum, pool) => sum + pool.volume24h, 0)

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
        if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
        return `$${num.toFixed(2)}`
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 bg-gradient-to-br from-primary/10 to-transparent">
                    <p className="text-sm text-muted-foreground mb-1">TVL (Total Value Locked)</p>
                    <p className="text-3xl font-bold">{formatNumber(totalTVL)}</p>
                </Card>
                <Card className="p-6 bg-gradient-to-br from-accent/10 to-transparent">
                    <p className="text-sm text-muted-foreground mb-1">Volume (24h)</p>
                    <p className="text-3xl font-bold">{formatNumber(totalVolume)}</p>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="pools" className="w-full">
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="pools">Pools</TabsTrigger>
                        <TabsTrigger value="my-pools">My Pools</TabsTrigger>
                        <TabsTrigger value="rewards">My Rewards</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="pools" className="mt-4">
                    {/* Filters */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="default">LB (DLMM)</Badge>
                            <Badge variant="outline">All Pools</Badge>
                        </div>
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, symbol or address"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={() => refetch()}>
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button onClick={() => router.push("/create-pool")}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Pool
                        </Button>
                    </div>

                    {/* Status indicator */}
                    {pools.length > 0 && (
                        <div className="flex items-center gap-2 mb-2 text-xs text-green-500">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Connected to Base Sepolia - {pools.length} pool(s) found
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 mb-2 text-xs text-yellow-500">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            Contract error - check network connection
                        </div>
                    )}

                    {/* Pool Table */}
                    <Card className="overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-7 gap-4 p-4 bg-muted/50 text-sm font-medium text-muted-foreground border-b">
                            <div>POOL NAME</div>
                            <div className="text-right">VOLUME (24H)</div>
                            <div className="text-right">LIQUIDITY</div>
                            <div className="text-right">BIN STEP</div>
                            <div className="text-right">ACTIVE ID</div>
                            <div className="text-right">FEES (24H)</div>
                            <div className="text-right">APR (24H)</div>
                        </div>

                        {/* Loading State */}
                        {isLoading && (
                            <div className="p-8 flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-muted-foreground">Loading pools from contract...</span>
                            </div>
                        )}

                        {/* Pool Rows */}
                        {!isLoading && (
                            <div className="divide-y">
                                {filteredPools.map((pool) => (
                                    <PoolRow
                                        key={pool.id}
                                        pool={{
                                            id: pool.id,
                                            pairAddress: pool.pairAddress,
                                            tokenX: pool.tokenX,
                                            tokenY: pool.tokenY,
                                            binStep: pool.binStep,
                                            activeId: pool.activeId,
                                            volume24h: pool.volume24h,
                                            liquidity: pool.liquidity,
                                            depthPlus2: pool.liquidity * 0.3,
                                            depthMinus2: pool.liquidity * 0.6,
                                            fees24h: pool.fees24h,
                                            apr24h: pool.apr24h,
                                            hasRewards: pool.hasRewards,
                                        }}
                                        isExpanded={expandedPoolId === pool.id}
                                        onToggle={() => setExpandedPoolId(expandedPoolId === pool.id ? null : pool.id)}
                                    />
                                ))}
                            </div>
                        )}

                        {!isLoading && filteredPools.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground">
                                No pools found. Create a new pool to get started.
                            </div>
                        )}
                    </Card>

                    <p className="text-sm text-center text-muted-foreground mt-4">
                        {pools.length > 0
                            ? `${pools.length} pool(s) loaded from Base Sepolia`
                            : "No pools found - create a new pool to get started"
                        }
                    </p>
                </TabsContent>

                <TabsContent value="my-pools" className="mt-4">
                    <MyPools onManagePool={handleManagePool} />
                </TabsContent>

                <TabsContent value="rewards" className="mt-4">
                    <Card className="p-12 text-center">
                        <p className="text-muted-foreground">Connect wallet to view your rewards</p>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
