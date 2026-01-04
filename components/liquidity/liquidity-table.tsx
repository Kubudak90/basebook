"use client"

import { useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Token {
    symbol: string
    decimals: number
}

export interface LiquidityTableProps {
    tokenX: Token | null
    tokenY: Token | null
    amountX: string
    amountY: string
    priceRange: number[]
    binStep: number
}

export function LiquidityTable({ tokenX, tokenY, amountX, amountY, priceRange, binStep }: LiquidityTableProps) {
    const data = useMemo(() => {
        if (!tokenX || !tokenY || !amountX || !amountY) return []

        // Simulate bins based on price range
        const bins = []
        const rangeSize = priceRange[1] - priceRange[0]
        const numBins = 7 // Show 7 bins for visualization
        const startBinId = 8388608 - Math.floor(rangeSize / 2 / binStep)

        for (let i = 0; i < numBins; i++) {
            const binId = startBinId + i
            // Simplified price calculation simulation for display
            const price = (Math.pow(1.0001, binId - 8388608)).toFixed(5)

            // Distribution logic simulation
            let compositionX = "0%"
            let compositionY = "0%"
            let liquidity = "0%"

            if (i < numBins / 2) {
                compositionX = "0%"
                compositionY = "100%"
                liquidity = `${Math.floor(Math.random() * 20) + 10}%`
            } else if (i > numBins / 2) {
                compositionX = "100%"
                compositionY = "0%"
                liquidity = `${Math.floor(Math.random() * 20) + 10}%`
            } else {
                compositionX = "50%"
                compositionY = "50%"
                liquidity = "40%" // Peak liquidity
            }

            bins.push({
                id: binId,
                price,
                liquidity,
                compositionX,
                compositionY,
                active: i === Math.floor(numBins / 2)
            })
        }

        return bins
    }, [tokenX, tokenY, amountX, amountY, priceRange, binStep])

    if (!tokenX || !tokenY || !amountX || !amountY) {
        return (
            <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed bg-muted/20">
                Enter amounts to view liquidity distribution
            </div>
        )
    }

    return (
        <Card className="mt-6 border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center justify-between">
                    <span>Liquidity Distribution</span>
                    <Badge variant="outline" className="font-normal text-xs font-mono">
                        Bin Step: {binStep}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[100px]">Bin ID</TableHead>
                                <TableHead>Price ({tokenY.symbol}/{tokenX.symbol})</TableHead>
                                <TableHead>Liquidity</TableHead>
                                <TableHead className="text-right">Composition</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((bin) => (
                                <TableRow key={bin.id} className={bin.active ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/30"}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{bin.id}</TableCell>
                                    <TableCell className="font-medium">{bin.price}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 rounded-full bg-primary/20 w-16 overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: bin.liquidity }} />
                                            </div>
                                            <span className="text-xs text-muted-foreground">{bin.liquidity}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1 text-xs">
                                            {bin.compositionX !== "0%" && <span className="text-blue-500">{bin.compositionX} {tokenX.symbol}</span>}
                                            {bin.compositionX !== "0%" && bin.compositionY !== "0%" && <span className="text-muted-foreground">/</span>}
                                            {bin.compositionY !== "0%" && <span className="text-green-500">{bin.compositionY} {tokenY.symbol}</span>}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
