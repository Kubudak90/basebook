"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { AddLiquidity } from "@/components/liquidity/add-liquidity"
import { RemoveLiquidity } from "@/components/liquidity/remove-liquidity"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface PoolRowProps {
    pool: {
        id: string
        pairAddress: `0x${string}`
        tokenX: { symbol: string; logoURI?: string; address?: string; decimals?: number }
        tokenY: { symbol: string; logoURI?: string; address?: string; decimals?: number }
        binStep: number
        activeId: number
        volume24h: number
        liquidity: number
        depthPlus2: number
        depthMinus2: number
        fees24h: number
        apr24h: number
        hasRewards: boolean
    }
    isExpanded: boolean
    onToggle: () => void
}

export function PoolRow({ pool, isExpanded, onToggle }: PoolRowProps) {
    const formatNumber = (num: number) => {
        if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
        if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
        return `$${num.toFixed(2)}`
    }

    const formatPercent = (num: number) => {
        if (num >= 100) return `${num.toFixed(0)}%`
        return `${num.toFixed(2)}%`
    }

    return (
        <div>
            {/* Main Row */}
            <div
                onClick={onToggle}
                className={cn(
                    "grid grid-cols-7 gap-4 p-4 cursor-pointer transition-colors hover:bg-muted/50",
                    isExpanded && "bg-muted/30"
                )}
            >
                {/* Pool Name */}
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white border-2 border-background">
                            {pool.tokenX.symbol.slice(0, 2)}
                        </div>
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-xs font-bold text-white border-2 border-background">
                            {pool.tokenY.symbol.slice(0, 2)}
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">
                                {pool.tokenX.symbol} - {pool.tokenY.symbol}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {(pool.binStep / 100).toFixed(2)}%
                            </Badge>
                            {pool.hasRewards && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-purple-500">REWARDS</Badge>
                            )}
                        </div>
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
                    )}
                </div>

                {/* Volume */}
                <div className="text-right font-mono">{formatNumber(pool.volume24h)}</div>

                {/* Liquidity */}
                <div className="text-right font-mono">{formatNumber(pool.liquidity)}</div>

                {/* Bin Step */}
                <div className="text-right font-mono">{pool.binStep}</div>

                {/* Active ID */}
                <div className="text-right font-mono text-xs">{pool.activeId || "N/A"}</div>

                {/* Fees */}
                <div className="text-right font-mono">{formatNumber(pool.fees24h)}</div>

                {/* APR */}
                <div className="text-right font-mono text-green-400 font-semibold">
                    {formatPercent(pool.apr24h)}
                </div>
            </div>

            {/* Expanded Content - Liquidity Management */}
            {isExpanded && (
                <div className="border-t bg-muted/20 p-6">
                    <Tabs defaultValue="add" className="w-full">
                        <TabsList className="mb-4">
                            <TabsTrigger value="add">Add Liquidity</TabsTrigger>
                            <TabsTrigger value="remove">Remove Liquidity</TabsTrigger>
                            <TabsTrigger value="info">Pool Info</TabsTrigger>
                        </TabsList>
                        <TabsContent value="add">
                            <AddLiquidity
                                poolTokenX={pool.tokenX}
                                poolTokenY={pool.tokenY}
                                poolBinStep={pool.binStep}
                                poolPairAddress={pool.pairAddress}
                            />
                        </TabsContent>
                        <TabsContent value="remove">
                            <RemoveLiquidity />
                        </TabsContent>
                        <TabsContent value="info">
                            {/* Pool Stats */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <div className="p-4 rounded-lg bg-muted/30">
                                    <p className="text-xs text-muted-foreground mb-1">Pool Address</p>
                                    <p className="font-mono text-sm">0x1234...5678</p>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/30">
                                    <p className="text-xs text-muted-foreground mb-1">Bin Step</p>
                                    <p className="font-bold">{pool.binStep}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/30">
                                    <p className="text-xs text-muted-foreground mb-1">Base Fee</p>
                                    <p className="font-bold">{(pool.binStep / 100).toFixed(2)}%</p>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/30">
                                    <p className="text-xs text-muted-foreground mb-1">24h Volume</p>
                                    <p className="font-bold">{formatNumber(pool.volume24h)}</p>
                                </div>
                            </div>

                            {/* Pool Liquidity Distribution */}
                            <div className="p-4 rounded-lg border bg-muted/20">
                                <h4 className="text-sm font-medium mb-4">Pool Liquidity Distribution</h4>
                                <div className="h-[200px] flex items-end justify-center gap-0.5">
                                    {Array.from({ length: 50 }).map((_, i) => {
                                        const height = Math.sin(i * 0.2) * 30 + 50 + Math.random() * 20
                                        const isActive = i === 25
                                        return (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "w-2 rounded-t transition-all",
                                                    isActive ? "bg-primary" : i < 25 ? "bg-orange-500" : "bg-blue-500"
                                                )}
                                                style={{ height: `${height}%`, opacity: isActive ? 1 : 0.7 }}
                                            />
                                        )
                                    })}
                                </div>
                                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                    <span>$0.00087</span>
                                    <span className="text-primary font-medium">Current: $0.00100</span>
                                    <span>$0.00113</span>
                                </div>
                                <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded bg-orange-500" />
                                        <span className="text-muted-foreground">{pool.tokenY.symbol}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded bg-primary" />
                                        <span className="text-muted-foreground">Active</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded bg-blue-500" />
                                        <span className="text-muted-foreground">{pool.tokenX.symbol}</span>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </div>
    )
}
