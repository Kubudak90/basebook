"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
    DollarSign,
    Percent,
    TrendingUp,
    AlertTriangle,
    Calendar,
    Info
} from "lucide-react"

interface Token {
    symbol: string
    decimals: number
}

interface LiquidityStatsProps {
    tokenX: Token | null
    tokenY: Token | null
    amountX: string
    amountY: string
    currentPrice: number
    minPrice: number
    maxPrice: number
    binStep: number
    tokenXPrice?: number // USD price of tokenX
    tokenYPrice?: number // USD price of tokenY
    poolTotalLiquidity?: number // Total pool liquidity in USD (mock data)
    pool24hVolume?: number // 24h volume (mock data)
}

export function LiquidityStats({
    tokenX,
    tokenY,
    amountX,
    amountY,
    currentPrice,
    minPrice,
    maxPrice,
    binStep,
    tokenXPrice = 2500, // Default mock ETH price
    tokenYPrice = 1, // Default mock USDC price
    poolTotalLiquidity = 1000000,
    pool24hVolume = 250000
}: LiquidityStatsProps) {
    const parsedAmountX = parseFloat(amountX) || 0
    const parsedAmountY = parseFloat(amountY) || 0

    // Position Value in USD
    const positionValue = useMemo(() => {
        const valueX = parsedAmountX * tokenXPrice
        const valueY = parsedAmountY * tokenYPrice
        return {
            total: valueX + valueY,
            tokenX: valueX,
            tokenY: valueY
        }
    }, [parsedAmountX, parsedAmountY, tokenXPrice, tokenYPrice])

    // Pool Share
    const poolShare = useMemo(() => {
        if (poolTotalLiquidity <= 0 || positionValue.total <= 0) return 0
        return (positionValue.total / (poolTotalLiquidity + positionValue.total)) * 100
    }, [positionValue.total, poolTotalLiquidity])

    // Estimated APR (simplified calculation)
    const estimatedAPR = useMemo(() => {
        // Fee tier based on bin step (basis points)
        const feeRate = binStep / 10000
        // Daily fee = pool share * 24h volume * fee rate
        const dailyFee = (poolShare / 100) * pool24hVolume * feeRate
        // Annualized
        const yearlyFee = dailyFee * 365
        // APR = yearly fee / position value
        if (positionValue.total <= 0) return 0
        return (yearlyFee / positionValue.total) * 100
    }, [poolShare, pool24hVolume, binStep, positionValue.total])

    // Impermanent Loss calculation (simplified)
    const impermanentLoss = useMemo(() => {
        // Calculate expected IL based on price range
        const rangeWidth = (maxPrice - minPrice) / currentPrice

        // IL risk increases with narrower ranges
        if (rangeWidth < 0.1) return { percent: 25, risk: "high" as const }
        if (rangeWidth < 0.3) return { percent: 10, risk: "medium" as const }
        if (rangeWidth < 0.5) return { percent: 5, risk: "low" as const }
        return { percent: 2, risk: "minimal" as const }
    }, [minPrice, maxPrice, currentPrice])

    // Fee Projections
    const feeProjections = useMemo(() => {
        const feeRate = binStep / 10000
        const dailyShare = (poolShare / 100) * pool24hVolume * feeRate
        return {
            daily: dailyShare,
            monthly: dailyShare * 30,
            yearly: dailyShare * 365
        }
    }, [poolShare, pool24hVolume, binStep])

    const formatUSD = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
        if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`
        return `$${value.toFixed(2)}`
    }

    if (!tokenX || !tokenY || (!amountX && !amountY)) {
        return null
    }

    const statsCards = [
        {
            title: "Position Value",
            icon: <DollarSign className="h-4 w-4" />,
            value: formatUSD(positionValue.total),
            subValues: [
                { label: tokenX.symbol, value: `${parsedAmountX.toFixed(4)} (${formatUSD(positionValue.tokenX)})` },
                { label: tokenY.symbol, value: `${parsedAmountY.toFixed(4)} (${formatUSD(positionValue.tokenY)})` }
            ],
            color: "text-primary"
        },
        {
            title: "Pool Share",
            icon: <Percent className="h-4 w-4" />,
            value: `${poolShare.toFixed(4)}%`,
            description: "Estimated share after deposit",
            badge: poolShare > 1 ? { text: "Large Position", variant: "default" as const } : undefined,
            color: "text-blue-400"
        },
        {
            title: "Estimated APR",
            icon: <TrendingUp className="h-4 w-4" />,
            value: `${estimatedAPR.toFixed(2)}%`,
            description: "Based on 24h fees",
            badge: estimatedAPR > 50
                ? { text: "High Yield", variant: "default" as const }
                : estimatedAPR > 20
                    ? { text: "Good Yield", variant: "secondary" as const }
                    : undefined,
            color: estimatedAPR > 30 ? "text-green-400" : "text-yellow-400"
        },
        {
            title: "Impermanent Loss Risk",
            icon: <AlertTriangle className="h-4 w-4" />,
            value: `~${impermanentLoss.percent}%`,
            description: "Potential IL if price moves to range edge",
            badge: {
                text: impermanentLoss.risk.charAt(0).toUpperCase() + impermanentLoss.risk.slice(1),
                variant: impermanentLoss.risk === "high" ? "destructive" as const :
                    impermanentLoss.risk === "medium" ? "outline" as const :
                        "secondary" as const
            },
            color: impermanentLoss.risk === "high" ? "text-red-400" :
                impermanentLoss.risk === "medium" ? "text-yellow-400" : "text-green-400"
        },
        {
            title: "Fee Projections",
            icon: <Calendar className="h-4 w-4" />,
            value: formatUSD(feeProjections.daily) + "/day",
            subValues: [
                { label: "Monthly", value: formatUSD(feeProjections.monthly) },
                { label: "Yearly", value: formatUSD(feeProjections.yearly) }
            ],
            color: "text-purple-400"
        }
    ]

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    Position Statistics
                </h4>
                <Badge variant="outline" className="text-[10px]">
                    Fee Tier: {binStep / 100}%
                </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {statsCards.map((stat, index) => (
                    <Card
                        key={stat.title}
                        className={cn(
                            "p-4 bg-muted/30 border-border/50 hover:bg-muted/50 transition-colors",
                            index === 0 && "sm:col-span-2 lg:col-span-1"
                        )}
                    >
                        <CardContent className="p-0 space-y-2">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    {stat.icon}
                                    <span className="text-xs">{stat.title}</span>
                                </div>
                                {stat.badge && (
                                    <Badge variant={stat.badge.variant} className="text-[9px] px-1.5">
                                        {stat.badge.text}
                                    </Badge>
                                )}
                            </div>

                            {/* Value */}
                            <p className={cn("text-lg font-semibold font-mono", stat.color)}>
                                {stat.value}
                            </p>

                            {/* Sub values or description */}
                            {stat.subValues && (
                                <div className="space-y-1">
                                    {stat.subValues.map((sub) => (
                                        <div key={sub.label} className="flex items-center justify-between text-[10px]">
                                            <span className="text-muted-foreground">{sub.label}</span>
                                            <span className="font-mono">{sub.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {stat.description && !stat.subValues && (
                                <p className="text-[10px] text-muted-foreground">{stat.description}</p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Warning for high IL */}
            {impermanentLoss.risk === "high" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
                    <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                        <p className="font-medium text-red-400">High Impermanent Loss Risk</p>
                        <p className="text-xs text-muted-foreground">
                            Your price range is narrow. If the price moves significantly, you may experience substantial impermanent loss.
                            Consider widening your range or using a Spot strategy for lower risk.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
