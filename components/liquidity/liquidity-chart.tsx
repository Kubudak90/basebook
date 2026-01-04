"use client"

import { useMemo } from "react"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StrategyType } from "./strategy-selector"

interface Token {
    symbol: string
    decimals: number
}

interface LiquidityChartProps {
    tokenX: Token | null
    tokenY: Token | null
    amountX: string
    amountY: string
    strategy: StrategyType
    minPrice: number
    maxPrice: number
    currentPrice: number
    numBins?: number
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, tokenX, tokenY }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload
        const hasUserLiquidity = data.userX > 0 || data.userY > 0
        return (
            <div className="bg-popover border border-border rounded-lg p-3 shadow-xl">
                <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Bin ID:</span>
                        <span className="font-mono font-medium">{data.binId}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Price:</span>
                        <span className="font-mono text-xs">{data.midPrice.toFixed(4)}</span>
                    </div>
                    {hasUserLiquidity && (
                        <>
                            <hr className="border-border" />
                            <p className="font-medium text-xs">My Liquidity:</p>
                            {data.userX > 0 && (
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-red-400">{tokenX?.symbol}:</span>
                                    <span className="font-mono">{data.userX.toFixed(2)}%</span>
                                </div>
                            )}
                            {data.userY > 0 && (
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-green-400">{tokenY?.symbol}:</span>
                                    <span className="font-mono">{data.userY.toFixed(2)}%</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        )
    }
    return null
}

export function LiquidityChart({
    tokenX,
    tokenY,
    amountX,
    amountY,
    strategy,
    minPrice,
    maxPrice,
    currentPrice,
    numBins = 50
}: LiquidityChartProps) {
    const chartData = useMemo(() => {
        if (!tokenX || !tokenY || minPrice >= maxPrice) {
            return []
        }

        const bins = []
        const priceRange = maxPrice - minPrice
        const binWidth = priceRange / numBins
        const totalAmountX = parseFloat(amountX) || 0
        const totalAmountY = parseFloat(amountY) || 0
        const hasUserInput = totalAmountX > 0 || totalAmountY > 0

        const activeBinIndex = Math.floor((currentPrice - minPrice) / binWidth)

        for (let i = 0; i < numBins; i++) {
            const priceMin = minPrice + i * binWidth
            const priceMax = minPrice + (i + 1) * binWidth
            const midPrice = (priceMin + priceMax) / 2

            // Gray background (always visible)
            const grayBase = 30

            // User's new liquidity based on strategy
            let userDistribution = 0
            const center = numBins / 2
            const normalizedPos = (i - center) / center

            if (hasUserInput) {
                switch (strategy) {
                    case "spot":
                        userDistribution = 100 / numBins
                        break
                    case "curve":
                        const sigma = 0.3
                        userDistribution = Math.exp(-(normalizedPos * normalizedPos) / (2 * sigma * sigma)) * 3
                        break
                    case "bidask":
                        userDistribution = (Math.abs(normalizedPos) * Math.abs(normalizedPos) + 0.1) * 2
                        break
                }
            }

            // User amounts based on position relative to current price
            let userX = 0
            let userY = 0
            if (hasUserInput) {
                if (midPrice > currentPrice) {
                    userX = userDistribution
                } else {
                    userY = userDistribution
                }
            }

            bins.push({
                binId: 8388608 + i - Math.floor(numBins / 2),
                index: i,
                priceMin,
                priceMax,
                midPrice,
                gray: grayBase,
                userX,
                userY,
                isActive: i === activeBinIndex
            })
        }

        // Normalize user amounts
        const maxUser = Math.max(...bins.map(b => b.userX + b.userY), 1)
        bins.forEach(bin => {
            bin.userX = (bin.userX / maxUser) * 70
            bin.userY = (bin.userY / maxUser) * 70
        })

        return bins
    }, [tokenX, tokenY, amountX, amountY, strategy, minPrice, maxPrice, currentPrice, numBins])

    const hasUserInput = (parseFloat(amountX) || 0) > 0 || (parseFloat(amountY) || 0) > 0

    if (!tokenX || !tokenY) {
        return (
            <Card className="border-dashed bg-muted/20">
                <CardContent className="p-8 text-center text-muted-foreground">
                    Select tokens to view liquidity distribution
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">
                        {hasUserInput ? "Your Liquidity Preview" : "Select Bins to Add Liquidity"}
                    </CardTitle>
                    <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                            {numBins} bins
                        </Badge>
                        <Badge variant="secondary" className="text-xs capitalize">
                            {strategy}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis
                                dataKey="midPrice"
                                tickFormatter={(value) => value.toFixed(2)}
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={{ stroke: 'hsl(var(--border))' }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tickFormatter={(value) => `${value.toFixed(0)}%`}
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={{ stroke: 'hsl(var(--border))' }}
                                width={40}
                            />
                            <Tooltip
                                content={<CustomTooltip tokenX={tokenX} tokenY={tokenY} />}
                                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                            />
                            <ReferenceLine
                                x={currentPrice}
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{
                                    value: "Current",
                                    position: "top",
                                    fill: "hsl(var(--primary))",
                                    fontSize: 10
                                }}
                            />
                            {/* Gray background bins */}
                            <Bar dataKey="gray" stackId="main" maxBarSize={10} radius={[0, 0, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`gray-${index}`}
                                        fill="hsl(var(--muted-foreground))"
                                        opacity={0.2}
                                    />
                                ))}
                            </Bar>
                            {/* User's TokenY (green) - below current price */}
                            <Bar dataKey="userY" stackId="main" fill="#22c55e" maxBarSize={10} radius={[0, 0, 0, 0]} />
                            {/* User's TokenX (red) - above current price */}
                            <Bar dataKey="userX" stackId="main" fill="#ef4444" maxBarSize={10} radius={[2, 2, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-muted-foreground/30" />
                        <span className="text-muted-foreground">Available Bins</span>
                    </div>
                    {hasUserInput && (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-green-500" />
                                <span className="text-muted-foreground">My {tokenY?.symbol}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-red-500" />
                                <span className="text-muted-foreground">My {tokenX?.symbol}</span>
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
