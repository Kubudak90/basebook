"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/animate-ui/components/buttons/button"
import { TokenSelect } from "./token-select"
import { ArrowDown, Settings } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts } from "wagmi"
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses"
import { LBRouterABI, ERC20ABI, LBFactoryABI, LBPairABI } from "@/lib/contracts/abis"
import { useTokenBalance } from "@/lib/hooks/use-token-balance"
import { useTokenAllowance } from "@/lib/hooks/use-token-allowance"
import { parseUnits, formatUnits } from "viem"
import { useToast } from "@/hooks/use-toast"
import { usePrices } from "@/hooks/use-prices"
import { Spinner } from "@/components/ui/spinner"
import { baseSepolia } from "wagmi/chains"
import { useTransactionHistory } from "@/hooks/use-transaction-history"

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
}

export function SwapCard() {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()
  const { addTransaction, updateTransaction } = useTransactionHistory()

  const [fromToken, setFromToken] = useState<Token | null>(TOKENS.WETH)
  const [toToken, setToToken] = useState<Token | null>(TOKENS.USDC)
  const [fromAmount, setFromAmount] = useState("")
  const [slippage, setSlippage] = useState("0.5")
  const [isQuoting, setIsQuoting] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

  const { formattedBalance: fromBalance } = useTokenBalance(fromToken?.address as `0x${string}`)
  const { allowance, refetch: refetchAllowance } = useTokenAllowance(
    fromToken?.address as `0x${string}`,
    CONTRACTS.LBRouter as `0x${string}`,
  )

  // Get CoinGecko prices for comparison
  const { getPairPrice } = usePrices(
    fromToken && toToken ? [fromToken.symbol, toToken.symbol] : []
  )
  const marketPrice = useMemo(() => {
    if (!fromToken || !toToken) return null
    return getPairPrice(fromToken.symbol, toToken.symbol)
  }, [fromToken, toToken, getPairPrice])

  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [swapTxHash, setSwapTxHash] = useState<`0x${string}` | undefined>()

  const { isLoading: isApproving } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  })

  const { isLoading: isSwapping, isSuccess: isSwapSuccess, isError: isSwapError } = useWaitForTransactionReceipt({
    hash: swapTxHash,
  })

  // Track swap transaction status
  useEffect(() => {
    if (!swapTxHash) return

    if (isSwapSuccess) {
      updateTransaction(swapTxHash, { status: "success" })
      toast({
        title: "Swap successful",
        description: "Your tokens have been swapped",
      })
    } else if (isSwapError) {
      updateTransaction(swapTxHash, { status: "failed", errorMessage: "Transaction failed" })
    }
  }, [swapTxHash, isSwapSuccess, isSwapError, updateTransaction, toast])

  // Sort tokens for factory lookup (tokenX < tokenY by address)
  const sortedTokens = useMemo(() => {
    if (!fromToken || !toToken) return null
    const fromAddr = fromToken.address.toLowerCase()
    const toAddr = toToken.address.toLowerCase()
    
    if (fromAddr < toAddr) {
      return { tokenX: fromToken.address, tokenY: toToken.address }
    } else {
      return { tokenX: toToken.address, tokenY: fromToken.address }
    }
  }, [fromToken, toToken])

  // Step 1: Find the LBPair address from factory
  const { data: pairInfo } = useReadContract({
    address: CONTRACTS.LBFactory as `0x${string}`,
    abi: LBFactoryABI,
    functionName: "getAllLBPairs",
    args: sortedTokens ? [sortedTokens.tokenX as `0x${string}`, sortedTokens.tokenY as `0x${string}`] : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: !!sortedTokens,
    },
  })

  // Extract first available pair
  const lbPairAddress = useMemo(() => {
    if (!pairInfo || !Array.isArray(pairInfo) || pairInfo.length === 0) return null
    const firstPair = pairInfo[0]
    if (!firstPair || firstPair.lbPair === "0x0000000000000000000000000000000000000000") return null
    return firstPair.lbPair as `0x${string}`
  }, [pairInfo])

  // Also get the binStep for the swap
  const binStep = useMemo(() => {
    if (!pairInfo || !Array.isArray(pairInfo) || pairInfo.length === 0) return 25
    return Number(pairInfo[0].binStep)
  }, [pairInfo])

  // Step 1.5: Get ACTUAL token order and activeId from pool contract
  const { data: poolTokenData } = useReadContracts({
    contracts: lbPairAddress
      ? [
          {
            address: lbPairAddress,
            abi: LBPairABI,
            functionName: "getTokenX",
            chainId: baseSepolia.id,
          },
          {
            address: lbPairAddress,
            abi: LBPairABI,
            functionName: "getTokenY",
            chainId: baseSepolia.id,
          },
          {
            address: lbPairAddress,
            abi: LBPairABI,
            functionName: "getActiveId",
            chainId: baseSepolia.id,
          },
        ]
      : [],
  })

  // Calculate pool's actual price from activeId
  const poolPriceFromActiveId = useMemo(() => {
    if (!poolTokenData?.[2]?.result || !fromToken || !toToken) return null
    
    const activeId = Number(poolTokenData[2].result)
    const contractTokenX = poolTokenData[0]?.status === "success" 
      ? (poolTokenData[0].result as string).toLowerCase() 
      : null
    
    if (!contractTokenX) return null
    
    // Price formula: price = (1 + binStep/10000) ^ (activeId - 8388608)
    // This gives price of tokenY in terms of tokenX
    const priceYperX = Math.pow(1 + binStep / 10000, activeId - 8388608)
    
    // Determine which direction we need
    const fromIsTokenX = fromToken.address.toLowerCase() === contractTokenX
    
    // If fromToken is tokenX, we get tokenY, so rate = priceYperX
    // If fromToken is tokenY, we get tokenX, so rate = 1/priceYperX
    return fromIsTokenX ? priceYperX : 1 / priceYperX
  }, [poolTokenData, fromToken, toToken, binStep])

  // Determine swapForY based on ACTUAL pool token order
  const swapForY = useMemo(() => {
    if (!poolTokenData || !fromToken) return null
    
    const contractTokenX = poolTokenData[0]?.status === "success" 
      ? (poolTokenData[0].result as string).toLowerCase() 
      : null
    
    if (!contractTokenX) return null
    
    // swapForY = true means: send tokenX, receive tokenY
    // swapForY = false means: send tokenY, receive tokenX
    const fromIsTokenX = fromToken.address.toLowerCase() === contractTokenX
    
    // If we're sending tokenX, we want tokenY (swapForY = true)
    // If we're sending tokenY, we want tokenX (swapForY = false)
    return fromIsTokenX
  }, [poolTokenData, fromToken])

  // Prepare amount for quote
  const amountIn = useMemo(() => {
    if (!fromToken || !fromAmount || Number(fromAmount) <= 0) return null
    try {
      return parseUnits(fromAmount, fromToken.decimals)
    } catch {
      return null
    }
  }, [fromToken, fromAmount])

  // Step 2: Get swap quote from LBRouter.getSwapOut
  const { data: swapOutData, isLoading: isLoadingQuote, error: quoteError } = useReadContract({
    address: CONTRACTS.LBRouter as `0x${string}`,
    abi: LBRouterABI,
    functionName: "getSwapOut",
    args: lbPairAddress && amountIn && swapForY !== null
      ? [lbPairAddress, amountIn, swapForY]
      : undefined,
    chainId: baseSepolia.id,
    query: {
      enabled: !!lbPairAddress && !!amountIn && swapForY !== null,
      refetchInterval: 10000,
    },
  })

  // Debug logging
  useEffect(() => {
    if (lbPairAddress && amountIn && swapForY !== null) {
      const activeId = poolTokenData?.[2]?.result
      console.log("🔍 Swap quote params:", {
        lbPairAddress,
        amountIn: amountIn.toString(),
        swapForY,
        fromToken: fromToken?.symbol,
        toToken: toToken?.symbol,
        contractTokenX: poolTokenData?.[0]?.result,
        contractTokenY: poolTokenData?.[1]?.result,
        activeId: activeId?.toString(),
        poolPriceFromActiveId,
        binStep,
      })
    }
    if (swapOutData) {
      const result = swapOutData as readonly [bigint, bigint, bigint]
      console.log("✅ Swap out data:", {
        amountInLeft: result[0]?.toString(),
        amountOut: result[1]?.toString(),
        fee: result[2]?.toString(),
      })
    }
    if (quoteError) {
      console.error("❌ Quote error:", quoteError)
    }
  }, [lbPairAddress, amountIn, swapForY, swapOutData, quoteError, fromToken, toToken, poolTokenData, poolPriceFromActiveId, binStep])

  // Calculate output amount from getSwapOut
  const calculatedOutput = useMemo(() => {
    if (!swapOutData || !toToken) return null

    try {
      // getSwapOut returns: (amountInLeft, amountOut, fee)
      const result = swapOutData as readonly [bigint, bigint, bigint]
      const amountOut = result[1]
      return formatUnits(amountOut, toToken.decimals)
    } catch {
      return null
    }
  }, [swapOutData, toToken])

  // Calculate fee from swap
  const swapFee = useMemo(() => {
    if (!swapOutData || !fromToken) return null

    try {
      const result = swapOutData as readonly [bigint, bigint, bigint]
      const fee = result[2]
      return formatUnits(fee, fromToken.decimals)
    } catch {
      return null
    }
  }, [swapOutData, fromToken])

  // Calculate price impact (simplified - based on fee percentage)
  const priceImpact = useMemo(() => {
    if (!swapFee || !fromAmount || !fromToken) return null

    try {
      const feeNum = Number.parseFloat(swapFee)
      const inputNum = Number.parseFloat(fromAmount)
      if (inputNum === 0) return null

      // Price impact is approximately fee / input * 100
      const impact = (feeNum / inputNum) * 100
      return impact
    } catch {
      return null
    }
  }, [swapFee, fromAmount, fromToken])

  // Get price impact color and severity
  const getPriceImpactColor = (impact: number | null) => {
    if (impact === null) return { color: "text-muted-foreground", bg: "bg-muted" }
    if (impact < 1) return { color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" }
    if (impact < 3) return { color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950" }
    if (impact < 5) return { color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950" }
    return { color: "text-red-600", bg: "bg-red-50 dark:bg-red-950" }
  }

  const getPriceImpactWarning = (impact: number | null) => {
    if (impact === null) return null
    if (impact >= 5) return "High price impact! Your trade will significantly move the market price."
    if (impact >= 3) return "Moderate price impact. Consider splitting into smaller trades."
    if (impact >= 1) return "Low price impact."
    return null
  }

  // Calculate minimum received with slippage using BigInt for precision
  const minReceived = useMemo(() => {
    if (!calculatedOutput || !toToken) return null

    try {
      const expectedOut = parseUnits(calculatedOutput, toToken.decimals)
      const slippageBps = BigInt(Math.floor(Number.parseFloat(slippage) * 100))
      const minOut = (expectedOut * (BigInt(10000) - slippageBps)) / BigInt(10000)
      return formatUnits(minOut, toToken.decimals)
    } catch {
      return null
    }
  }, [calculatedOutput, toToken, slippage])

  // Validate input amount
  const validateAmount = (amount: string): string | null => {
    if (!amount || amount.trim() === "") {
      return null // Empty is ok, just disable button
    }

    const num = Number.parseFloat(amount)

    if (isNaN(num)) {
      return "Please enter a valid number"
    }

    if (num <= 0) {
      return "Amount must be greater than 0"
    }

    if (num < 0) {
      return "Amount cannot be negative"
    }

    // Check against balance
    if (fromToken && fromBalance) {
      const balance = Number.parseFloat(fromBalance)
      if (num > balance) {
        return `Insufficient balance. You have ${fromBalance} ${fromToken.symbol}`
      }
    }

    return null
  }

  // Validate slippage
  const validateSlippage = (slip: string): string | null => {
    const num = Number.parseFloat(slip)

    if (isNaN(num)) {
      return "Invalid slippage"
    }

    if (num < 0.01) {
      return "Slippage too low (min 0.01%)"
    }

    if (num > 50) {
      return "Slippage too high (max 50%)"
    }

    return null
  }

  const handleAmountChange = (value: string) => {
    setFromAmount(value)
    const error = validateAmount(value)
    setInputError(error)
  }

  const handleSlippageChange = (value: string) => {
    setSlippage(value)
    const error = validateSlippage(value)
    if (error) {
      toast({
        title: "Invalid slippage",
        description: error,
        variant: "destructive",
      })
    }
  }

  const handleSwap = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    // Clear from amount when swapping to trigger new quote
    setFromAmount("")
    setInputError(null)
  }

  const needsApproval = () => {
    if (!fromAmount || !fromToken) return false
    try {
      const amount = parseUnits(fromAmount, fromToken.decimals)
      return (allowance as bigint) < amount
    } catch {
      return false
    }
  }

  const handleApprove = async () => {
    if (!fromToken || !fromAmount) return

    try {
      const amount = parseUnits(fromAmount, fromToken.decimals)
      const hash = await writeContractAsync({
        address: fromToken.address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "approve",
        args: [CONTRACTS.LBRouter, amount],
      })

      setApproveTxHash(hash)
      toast({
        title: "Approval submitted",
        description: "Waiting for confirmation...",
      })

      await refetchAllowance()
    } catch (error: any) {
      toast({
        title: "Approval failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleSwapTokens = async () => {
    if (!fromToken || !toToken || !fromAmount || !address || !calculatedOutput || !amountIn) return

    try {
      const expectedOut = parseUnits(calculatedOutput, toToken.decimals)

      // Apply slippage protection using basis points to avoid floating point precision issues
      // slippage is percentage (e.g., "0.5" = 0.5%), convert to basis points (50 bps)
      const slippageBps = BigInt(Math.floor(Number.parseFloat(slippage) * 100))
      const minAmountOut = (expectedOut * (BigInt(10000) - slippageBps)) / BigInt(10000)

      // Use binStep from the pool we found
      const binSteps = [BigInt(binStep)]

      const hash = await writeContractAsync({
        address: CONTRACTS.LBRouter as `0x${string}`,
        abi: LBRouterABI,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          minAmountOut,
          binSteps,
          [fromToken.address as `0x${string}`, toToken.address as `0x${string}`],
          address,
          BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 min deadline
        ],
      })

      setSwapTxHash(hash)

      // Add to transaction history
      addTransaction({
        type: "swap",
        status: "pending",
        hash,
        fromToken: {
          symbol: fromToken.symbol,
          amount: fromAmount,
        },
        toToken: {
          symbol: toToken.symbol,
          amount: calculatedOutput,
        },
      })

      toast({
        title: "Swap submitted",
        description: "Waiting for confirmation...",
      })

      setFromAmount("")
    } catch (error: any) {
      toast({
        title: "Swap failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Swap</span>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">From</span>
            <span className="text-muted-foreground">Balance: {fromBalance}</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className={`flex-1 ${inputError ? "border-red-500" : ""}`}
              min="0"
              step="any"
            />
            <TokenSelect selectedToken={fromToken} onSelectToken={setFromToken} excludeToken={toToken} />
          </div>
          {inputError && (
            <p className="text-xs text-red-500">{inputError}</p>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button variant="ghost" size="icon" onClick={handleSwap} className="rounded-full">
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">To</span>
            <span className="text-muted-foreground">
              {isLoadingQuote ? "Calculating..." : "Estimated"}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="0.0"
                value={calculatedOutput || ""}
                disabled
                className="flex-1 pr-8"
              />
              {isLoadingQuote && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Spinner className="h-4 w-4" />
                </div>
              )}
            </div>
            <TokenSelect selectedToken={toToken} onSelectToken={setToToken} excludeToken={fromToken} />
          </div>
        </div>

        {/* Swap Details */}
        {fromAmount && calculatedOutput && (
          <div className="space-y-2 p-3 bg-muted rounded-lg text-sm">
            {/* Pool Rate (from getSwapOut) */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pool Rate (Swap)</span>
              <span>
                1 {fromToken?.symbol} ≈{" "}
                {(Number.parseFloat(calculatedOutput) / Number.parseFloat(fromAmount)).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                {toToken?.symbol}
              </span>
            </div>
            {/* Pool Rate (from activeId) */}
            {poolPriceFromActiveId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pool Rate (ActiveId)</span>
                <span className="text-amber-500">
                  1 {fromToken?.symbol} ≈{" "}
                  {poolPriceFromActiveId.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  {toToken?.symbol}
                </span>
              </div>
            )}
            {/* Market Rate (CoinGecko) */}
            {marketPrice && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Market Rate</span>
                <span className="text-green-500">
                  1 {fromToken?.symbol} ≈{" "}
                  {marketPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  {toToken?.symbol}
                </span>
              </div>
            )}
            {/* Expected Output at Market Rate */}
            {marketPrice && fromAmount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected (Market)</span>
                <span className="text-green-500">
                  {(Number.parseFloat(fromAmount) * marketPrice).toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                  {toToken?.symbol}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slippage Tolerance</span>
              <span>{slippage}%</span>
            </div>
            {priceImpact !== null && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={`font-semibold ${getPriceImpactColor(priceImpact).color}`}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum Received</span>
              <span>
                {minReceived ? Number.parseFloat(minReceived).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0.000000"}{" "}
                {toToken?.symbol}
              </span>
            </div>
          </div>
        )}

        {/* Pool vs Market Price Warning */}
        {fromAmount && calculatedOutput && marketPrice && (() => {
          const poolRate = Number.parseFloat(calculatedOutput) / Number.parseFloat(fromAmount)
          const priceDiff = Math.abs((poolRate - marketPrice) / marketPrice) * 100
          if (priceDiff > 10) {
            return (
              <div className="p-3 rounded-lg text-sm bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <span className="text-red-600 font-semibold">🚨</span>
                  <div className="text-red-600">
                    <p className="font-semibold">Pool Fiyatı Çok Farklı!</p>
                    <p className="text-xs mt-1">
                      Pool rate ({poolRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}) market rate'den 
                      ({marketPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}) <strong>{priceDiff.toFixed(0)}%</strong> farklı.
                      Bu swap'ı yapmak kayba yol açabilir!
                    </p>
                  </div>
                </div>
              </div>
            )
          }
          return null
        })()}

        {/* Price Impact Warning */}
        {priceImpact !== null && priceImpact >= 1 && (
          <div className={`p-3 rounded-lg text-sm ${getPriceImpactColor(priceImpact).bg}`}>
            <div className="flex items-start gap-2">
              <span className={`font-semibold ${getPriceImpactColor(priceImpact).color}`}>
                ⚠️
              </span>
              <p className={getPriceImpactColor(priceImpact).color}>
                {getPriceImpactWarning(priceImpact)}
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!isConnected ? (
          <Button className="w-full" disabled>
            Connect Wallet
          </Button>
        ) : needsApproval() ? (
          <Button className="w-full" onClick={handleApprove} disabled={isApproving}>
            {isApproving ? (
              <>
                <Spinner className="mr-2" />
                Approving...
              </>
            ) : (
              `Approve ${fromToken?.symbol}`
            )}
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={handleSwapTokens}
            disabled={!fromAmount || !calculatedOutput || isSwapping || isLoadingQuote || !!inputError}
          >
            {isSwapping ? (
              <>
                <Spinner className="mr-2" />
                Swapping...
              </>
            ) : isLoadingQuote ? (
              <>
                <Spinner className="mr-2" />
                Getting Quote...
              </>
            ) : inputError ? (
              "Invalid Input"
            ) : (
              "Swap"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
