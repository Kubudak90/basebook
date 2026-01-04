"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Target, Maximize2, TrendingUp, AlertTriangle } from "lucide-react"
import { StrategyType } from "./strategy-selector"

interface PriceRangeManagerProps {
    currentPrice: number
    minPrice: number
    maxPrice: number
    onMinPriceChange: (price: number) => void
    onMaxPriceChange: (price: number) => void
    volatilityPercent: number
    onVolatilityChange: (percent: number) => void
    strategy: StrategyType
    tokenXSymbol: string
    tokenYSymbol: string
}

export function PriceRangeManager({
    currentPrice,
    minPrice,
    maxPrice,
    onMinPriceChange,
    onMaxPriceChange,
    volatilityPercent,
    onVolatilityChange,
    strategy,
    tokenXSymbol,
    tokenYSymbol
}: PriceRangeManagerProps) {
    // Calculate range percentages from current price
    const minPercent = currentPrice > 0 ? ((minPrice - currentPrice) / currentPrice) * 100 : -50
    const maxPercent = currentPrice > 0 ? ((maxPrice - currentPrice) / currentPrice) * 100 : 50

    // Range width calculation
    const rangeWidth = currentPrice > 0 ? ((maxPrice - minPrice) / currentPrice) * 100 : 0

    // Capital efficiency estimation based on range width
    const capitalEfficiency = useMemo(() => {
        if (rangeWidth <= 0) return 0
        // Narrower range = higher efficiency
        const baseEfficiency = Math.min(100 / rangeWidth, 50) * 10
        return Math.min(Math.round(baseEfficiency), 500)
    }, [rangeWidth])

    // Price impact warning
    const priceImpact = useMemo(() => {
        if (rangeWidth < 5) return "high"
        if (rangeWidth < 20) return "medium"
        return "low"
    }, [rangeWidth])

    // Handle slider change
    const handleSliderChange = (values: number[]) => {
        const newMinPercent = values[0]
        const newMaxPercent = values[1]

        const newMinPrice = currentPrice * (1 + newMinPercent / 100)
        const newMaxPrice = currentPrice * (1 + newMaxPercent / 100)

        onMinPriceChange(Math.max(0.000001, newMinPrice))
        onMaxPriceChange(newMaxPrice)
    }

    // Auto-suggest ranges based on strategy
    const suggestOptimalRange = () => {
        let minP = -25
        let maxP = 25

        switch (strategy) {
            case "spot":
                minP = -50
                maxP = 50
                break
            case "curve":
                minP = -10
                maxP = 10
                break
            case "bidask":
                minP = -30
                maxP = 30
                break
        }

        // Apply volatility adjustment
        const volAdjustment = volatilityPercent / 100
        minP = minP * volAdjustment
        maxP = maxP * volAdjustment

        onMinPriceChange(currentPrice * (1 + minP / 100))
        onMaxPriceChange(currentPrice * (1 + maxP / 100))
    }

    const setFullRange = () => {
        onMinPriceChange(currentPrice * 0.01) // -99%
        onMaxPriceChange(currentPrice * 10) // +900%
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Price Range</Label>
                <span className="text-xs text-muted-foreground">
                    {tokenYSymbol}/{tokenXSymbol}
                </span>
            </div>

            {/* Current Price Display */}
            <div className="flex items-center justify-center p-3 bg-muted/50 rounded-lg">
                <div className="text-center">
                    <span className="text-xs text-muted-foreground">Current Price</span>
                    <p className="text-lg font-mono font-semibold text-primary">
                        {currentPrice.toFixed(6)}
                    </p>
                </div>
            </div>

            {/* Min/Max Price Inputs */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Min Price</Label>
                        <Badge variant="outline" className="text-[10px] px-1.5">
                            {minPercent.toFixed(1)}%
                        </Badge>
                    </div>
                    <Input
                        type="number"
                        value={minPrice.toFixed(6)}
                        onChange={(e) => onMinPriceChange(parseFloat(e.target.value) || 0)}
                        className="font-mono text-sm"
                        step="0.000001"
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Max Price</Label>
                        <Badge variant="outline" className="text-[10px] px-1.5">
                            +{maxPercent.toFixed(1)}%
                        </Badge>
                    </div>
                    <Input
                        type="number"
                        value={maxPrice.toFixed(6)}
                        onChange={(e) => onMaxPriceChange(parseFloat(e.target.value) || 0)}
                        className="font-mono text-sm"
                        step="0.000001"
                    />
                </div>
            </div>

            {/* Range Slider */}
            <div className="space-y-2 pt-2">
                <Label className="text-xs text-muted-foreground">Drag to adjust range</Label>
                <div className="px-2 py-4">
                    <Slider
                        value={[Math.max(-50, Math.min(0, minPercent)), Math.min(50, Math.max(0, maxPercent))]}
                        onValueChange={handleSliderChange}
                        min={-50}
                        max={50}
                        step={1}
                        minStepsBetweenThumbs={5}
                        className="w-full"
                    />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>-50%</span>
                    <span className="font-medium text-foreground">Current</span>
                    <span>+50%</span>
                </div>
            </div>

            {/* Volatility Expectation Slider */}
            <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Volatility Expectation</Label>
                    <Badge variant="secondary" className="text-xs">
                        {volatilityPercent}%
                    </Badge>
                </div>
                <Slider
                    value={[volatilityPercent]}
                    onValueChange={(v) => onVolatilityChange(v[0])}
                    min={10}
                    max={100}
                    step={5}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Low (10%)</span>
                    <span>High (100%)</span>
                </div>
            </div>

            {/* Auto Suggest Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={suggestOptimalRange}
                    className="gap-2"
                >
                    <Target className="h-3.5 w-3.5" />
                    Optimal Range
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={setFullRange}
                    className="gap-2"
                >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Full Range
                </Button>
            </div>

            {/* Indicators */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                <Card className="p-3 bg-muted/30">
                    <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Range Width</p>
                        <p className="text-sm font-semibold font-mono">
                            {rangeWidth.toFixed(1)}%
                        </p>
                    </div>
                </Card>
                <Card className="p-3 bg-muted/30">
                    <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Capital Eff.</p>
                        <p className={cn(
                            "text-sm font-semibold font-mono",
                            capitalEfficiency > 200 ? "text-green-400" :
                                capitalEfficiency > 100 ? "text-yellow-400" : "text-muted-foreground"
                        )}>
                            {capitalEfficiency}x
                        </p>
                    </div>
                </Card>
                <Card className={cn(
                    "p-3",
                    priceImpact === "high" ? "bg-red-500/10" :
                        priceImpact === "medium" ? "bg-yellow-500/10" : "bg-green-500/10"
                )}>
                    <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">Price Impact</p>
                        <div className="flex items-center justify-center gap-1">
                            {priceImpact === "high" && <AlertTriangle className="h-3 w-3 text-red-400" />}
                            <p className={cn(
                                "text-sm font-semibold capitalize",
                                priceImpact === "high" ? "text-red-400" :
                                    priceImpact === "medium" ? "text-yellow-400" : "text-green-400"
                            )}>
                                {priceImpact}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}
