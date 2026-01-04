"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TokenSelect } from "@/components/swap/token-select"
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { LBFactoryABI } from "@/lib/contracts/abis"
import { useToast } from "@/hooks/use-toast"
import { usePrices } from "@/hooks/use-prices"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft, RefreshCw } from "lucide-react"

interface Token {
    address: string
    symbol: string
    name: string
    decimals: number
    logoURI: string
}


const BIN_STEP_OPTIONS = [
    { value: 1, label: "0.01% (Ultra Stable)", description: "Best for identical pegs (USDC/DAI)" },
    { value: 2, label: "0.02% (Very Stable)", description: "Stablecoin pairs" },
    { value: 5, label: "0.05% (Stable)", description: "Correlated assets" },
    { value: 10, label: "0.1% (Low)", description: "Stable pairs (WETH/USDC)" },
    { value: 15, label: "0.15% (Medium-Low)", description: "Medium correlation" },
    { value: 20, label: "0.2% (Medium)", description: "Standard pairs" },
    { value: 25, label: "0.25% (Standard)", description: "Most pairs" },
    { value: 50, label: "0.5% (High)", description: "Higher volatility pairs" },
    { value: 100, label: "1% (Very High)", description: "Very volatile pairs" },
]

// Convert price to bin ID using LB formula: price = (1 + binStep/10000)^(id - 2^23)
const priceToBinId = (price: number, binStep: number): number => {
    if (price <= 0) return 8388608 // 2^23 center bin
    const binStepDecimal = 1 + binStep / 10000
    const id = Math.log(price) / Math.log(binStepDecimal) + 8388608
    return Math.round(id)
}

// Convert bin ID to price using LB formula
const binIdToPrice = (binId: number, binStep: number): number => {
    const binStepDecimal = 1 + binStep / 10000
    return Math.pow(binStepDecimal, binId - 8388608)
}

export default function CreatePoolPage() {
    const router = useRouter()
    const { address, isConnected } = useAccount()
    const { toast } = useToast()
    const { writeContractAsync } = useWriteContract()

    const [tokenX, setTokenX] = useState<Token | null>(null)
    const [tokenY, setTokenY] = useState<Token | null>(null)
    const [binStep, setBinStep] = useState(25)
    const [price, setPrice] = useState("") // Price of tokenY in terms of tokenX

    const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
    const { isLoading: isProcessing } = useWaitForTransactionReceipt({ hash: txHash })

    // Fetch live prices from CoinGecko
    const { getPrice, getPairPrice, isLoading: isPriceLoading } = usePrices()

    // Calculate initial price suggestion based on live USD prices
    // CRITICAL: Price must be "tokenY per tokenX" (how many tokenY for 1 tokenX)
    // But we need to account for token sorting (tokenX < tokenY)
    const suggestedPrice = useMemo(() => {
        if (!tokenX || !tokenY) return null
        
        // Get price: 1 tokenX = ? tokenY
        const price = getPairPrice(tokenX.symbol, tokenY.symbol)
        if (!price) return null
        
        // Check if tokens need to be swapped (tokenX must be < tokenY)
        const needsSwap = tokenX.address.toLowerCase() > tokenY.address.toLowerCase()
        
        // If tokens are swapped, price must be inverted
        // Original: 1 tokenX = price tokenY
        // Swapped: 1 tokenY = price tokenX, so 1 tokenX = 1/price tokenY
        return needsSwap ? 1 / price : price
    }, [tokenX, tokenY, getPairPrice])

    // Calculate USD equivalent of the entered price
    const usdEquivalent = useMemo(() => {
        if (!tokenX || !tokenY || !price) return null
        const priceNum = parseFloat(price)
        if (isNaN(priceNum) || priceNum <= 0) return null
        const tokenYUsdPrice = getPrice(tokenY.symbol) || 1
        return priceNum * tokenYUsdPrice
    }, [tokenX, tokenY, price, getPrice])

    // Calculate bin ID from price
    // CRITICAL: Price must be "tokenY per tokenX" for the FINAL sorted token order
    const activeId = useMemo(() => {
        if (!tokenX || !tokenY) return 8388608
        
        const priceNum = parseFloat(price)
        if (isNaN(priceNum) || priceNum <= 0) return 8388608
        
        // Check if tokens need to be swapped (tokenX must be < tokenY)
        const needsSwap = tokenX.address.toLowerCase() > tokenY.address.toLowerCase()
        
        // If tokens are swapped, price must be inverted
        // UI price: "1 UI_tokenX = price UI_tokenY"
        // After swap: "1 final_tokenX = ? final_tokenY"
        // If UI_tokenX becomes final_tokenY, then: 1 final_tokenX = 1/price final_tokenY
        const finalPrice = needsSwap ? 1 / priceNum : priceNum
        
        const calculatedId = priceToBinId(finalPrice, binStep)
        
        console.log("🔍 Bin ID Calculation:", {
            tokenX: tokenX.symbol,
            tokenY: tokenY.symbol,
            uiPrice: priceNum,
            needsSwap,
            finalPrice,
            calculatedId,
            binStep,
        })
        
        return calculatedId
    }, [price, binStep, tokenX, tokenY])

    const handleCreatePool = async () => {
        if (!tokenX || !tokenY || !address) return

        // Sort tokens: tokenX must be < tokenY (address comparison)
        const sortedTokens = tokenX.address.toLowerCase() < tokenY.address.toLowerCase()
            ? { tokenX: tokenX.address, tokenY: tokenY.address }
            : { tokenX: tokenY.address, tokenY: tokenX.address }

        try {
            const hash = await writeContractAsync({
                address: CONTRACTS.LBFactory as `0x${string}`,
                abi: LBFactoryABI,
                functionName: "createLBPair",
                args: [
                    sortedTokens.tokenX as `0x${string}`,
                    sortedTokens.tokenY as `0x${string}`,
                    Number(activeId),
                    binStep,
                ],
            })

            setTxHash(hash)
            toast({
                title: "Pool creation submitted",
                description: "Waiting for confirmation...",
            })

            // Redirect to pools page after success
            router.push("/pools")
        } catch (error: any) {
            toast({
                title: "Pool creation failed",
                description: error.shortMessage || error.message,
                variant: "destructive",
            })
        }
    }

    return (
        <div className="max-w-2xl mx-auto py-8">
            <Button
                variant="ghost"
                className="mb-6"
                onClick={() => router.push("/pools")}
            >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Pools
            </Button>

            <Card className="p-6">
                <h1 className="text-2xl font-bold mb-6">Create a New Pool</h1>

                <div className="space-y-6">
                    {/* Token Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Token X</Label>
                            <TokenSelect
                                selectedToken={tokenX}
                                onSelectToken={setTokenX}
                                excludeToken={tokenY}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Token Y</Label>
                            <TokenSelect
                                selectedToken={tokenY}
                                onSelectToken={setTokenY}
                                excludeToken={tokenX}
                            />
                        </div>
                    </div>

                    {/* Bin Step Selection */}
                    <div className="space-y-3">
                        <Label>Fee Tier (Bin Step)</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {BIN_STEP_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setBinStep(option.value)}
                                    className={`p-3 rounded-lg border text-left transition-colors ${binStep === option.value
                                        ? "border-primary bg-primary/10"
                                        : "border-border hover:border-primary/50"
                                        }`}
                                >
                                    <div className="font-medium">{option.label}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {option.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Initial Price */}
                    <div className="space-y-3">
                        <Label>Başlangıç Fiyatı</Label>
                        <div className="p-4 rounded-lg border bg-muted/20">
                            {tokenX && tokenY ? (
                                <>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-sm text-muted-foreground">1 {tokenX.symbol} =</span>
                                        <Input
                                            type="number"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            placeholder={suggestedPrice?.toFixed(6) || "0.00"}
                                            className="w-32 font-mono text-right"
                                        />
                                        <span className="font-medium">{tokenY.symbol}</span>
                                        {usdEquivalent && (
                                            <span className="text-sm text-muted-foreground">
                                                (${usdEquivalent.toFixed(2)} USD)
                                            </span>
                                        )}
                                    </div>
                                    {suggestedPrice && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPrice(suggestedPrice.toFixed(6))}
                                            className="text-xs"
                                        >
                                            Piyasa fiyatını kullan: {suggestedPrice.toFixed(2)} {tokenY.symbol}
                                        </Button>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Hesaplanan Bin ID: {activeId.toLocaleString()}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Fiyat ayarlamak için önce tokenleri seçin
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Summary */}
                    {tokenX && tokenY && (
                        <Card className="p-4 bg-muted/30">
                            <h3 className="font-medium mb-2">Pool Summary</h3>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Pair</span>
                                    <span>{tokenX.symbol} / {tokenY.symbol}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Bin Step</span>
                                    <span>{binStep} ({(binStep / 100).toFixed(2)}% fee)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Başlangıç Fiyatı</span>
                                    <span>
                                        1 {tokenX.symbol} = {price || suggestedPrice?.toFixed(2) || "—"} {tokenY.symbol}
                                        {usdEquivalent && ` ($${usdEquivalent.toFixed(2)})`}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Action Button */}
                    {!isConnected ? (
                        <Button className="w-full" size="lg" disabled>
                            Connect Wallet
                        </Button>
                    ) : (
                        <Button
                            className="w-full"
                            size="lg"
                            onClick={handleCreatePool}
                            disabled={!tokenX || !tokenY || isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <Spinner className="mr-2" />
                                    Creating Pool...
                                </>
                            ) : (
                                "Create Pool"
                            )}
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    )
}
