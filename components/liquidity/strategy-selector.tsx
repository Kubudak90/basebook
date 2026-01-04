"use client"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StrategyType = "spot" | "curve" | "bidask"

interface Strategy {
    id: StrategyType
    name: string
    nameTr: string
}

const strategies: Strategy[] = [
    {
        id: "spot",
        name: "Spot",
        nameTr: "Uniform"
    },
    {
        id: "curve",
        name: "Curve",
        nameTr: "Concentrated"
    },
    {
        id: "bidask",
        name: "Bid-Ask",
        nameTr: "Edges"
    }
]



interface StrategySelectorProps {
    selectedStrategy: StrategyType
    onSelectStrategy: (strategy: StrategyType) => void
}

export function StrategySelector({ selectedStrategy, onSelectStrategy }: StrategySelectorProps) {
    return (
        <div className="space-y-3">
            <label className="text-sm font-medium">Volatility Strategy</label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {strategies.map((strategy) => (
                    <Card
                        key={strategy.id}
                        onClick={() => onSelectStrategy(strategy.id)}
                        className={cn(
                            "relative p-3 cursor-pointer transition-all duration-200 hover:shadow-lg",
                            "border-2 hover:border-primary/50",
                            selectedStrategy === strategy.id
                                ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                : "border-border/50 bg-card/50 hover:bg-card/80"
                        )}
                    >
                        {/* Selection indicator */}
                        {selectedStrategy === strategy.id && (
                            <div className="absolute top-2 right-2">
                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            </div>
                        )}

                        {/* Header */}
                        <div className="text-center mb-2">
                            <h4 className="font-semibold text-sm">{strategy.name}</h4>
                            <p className="text-xs text-muted-foreground">{strategy.nameTr}</p>
                        </div>

                        {/* Visual Distribution Preview */}
                        <div className="flex items-end justify-center gap-0.5 h-10">
                            {strategy.id === "spot" && (
                                <>
                                    {[1, 1, 1, 1, 1, 1, 1, 1, 1].map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-2 rounded-t transition-all",
                                                selectedStrategy === strategy.id ? "bg-primary" : "bg-muted-foreground/30"
                                            )}
                                            style={{ height: "60%" }}
                                        />
                                    ))}
                                </>
                            )}
                            {strategy.id === "curve" && (
                                <>
                                    {[15, 30, 55, 80, 100, 80, 55, 30, 15].map((h, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-2 rounded-t transition-all",
                                                selectedStrategy === strategy.id ? "bg-primary" : "bg-muted-foreground/30"
                                            )}
                                            style={{ height: `${h}%` }}
                                        />
                                    ))}
                                </>
                            )}
                            {strategy.id === "bidask" && (
                                <>
                                    {[100, 60, 25, 10, 5, 10, 25, 60, 100].map((h, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-2 rounded-t transition-all",
                                                selectedStrategy === strategy.id ? "bg-primary" : "bg-muted-foreground/30"
                                            )}
                                            style={{ height: `${h}%` }}
                                        />
                                    ))}
                                </>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
