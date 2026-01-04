"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from "wagmi"
import { LBRouterABI, LBPairABI } from "@/lib/contracts/abis"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { useUserLiquidity } from "@/hooks/use-user-liquidity"
import { usePools } from "@/hooks/use-pools"
import { formatUnits } from "viem"
import { baseSepolia } from "wagmi/chains"
import { useTransactionHistory } from "@/hooks/use-transaction-history"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
}

export function RemoveLiquidity() {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()
  const { addTransaction, updateTransaction } = useTransactionHistory()

  // Fetch all available pools
  const { pools, isLoading: isLoadingPools } = usePools()

  // Pool selection state
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null)

  const [binRange, setBinRange] = useState([0, 0])
  const [percentage, setPercentage] = useState([100])
  const [slippage, setSlippage] = useState("0.5") // Default 0.5% slippage
  const [slippageError, setSlippageError] = useState<string | null>(null)

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isProcessing, isSuccess, isError } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Track transaction status
  useEffect(() => {
    if (!txHash) return

    if (isSuccess) {
      updateTransaction(txHash, { status: "success" })
      toast({
        title: "Liquidity removed successfully",
        description: "Your liquidity has been removed from the pool",
      })
    } else if (isError) {
      updateTransaction(txHash, { status: "failed", errorMessage: "Transaction failed" })
    }
  }, [txHash, isSuccess, isError, updateTransaction, toast])

  // Get selected pool info
  const selectedPool = useMemo(() => {
    if (!selectedPoolId) return null
    return pools.find(p => p.id === selectedPoolId) || null
  }, [selectedPoolId, pools])

  // Auto-select first pool if available
  useMemo(() => {
    if (!selectedPoolId && pools.length > 0) {
      setSelectedPoolId(pools[0].id)
    }
  }, [pools, selectedPoolId])

  // Get tokens from selected pool
  const tokenX = selectedPool ? {
    address: selectedPool.tokenX.address,
    symbol: selectedPool.tokenX.symbol,
    decimals: selectedPool.tokenX.decimals,
    name: selectedPool.tokenX.symbol,
    logoURI: "",
  } : null

  const tokenY = selectedPool ? {
    address: selectedPool.tokenY.address,
    symbol: selectedPool.tokenY.symbol,
    decimals: selectedPool.tokenY.decimals,
    name: selectedPool.tokenY.symbol,
    logoURI: "",
  } : null

  // Fetch real user liquidity positions for selected pool
  const { positions, activeId, isLoading } = useUserLiquidity(selectedPool?.pairAddress)

  // CRITICAL: Fetch contract's actual token order and approval status
  const { data: poolContractData, refetch: refetchPoolData } = useReadContracts({
    contracts: selectedPool?.pairAddress
      ? [
          {
            address: selectedPool.pairAddress,
            abi: LBPairABI,
            functionName: "getTokenX",
            chainId: baseSepolia.id,
          },
          {
            address: selectedPool.pairAddress,
            abi: LBPairABI,
            functionName: "getTokenY",
            chainId: baseSepolia.id,
          },
          {
            address: selectedPool.pairAddress,
            abi: LBPairABI,
            functionName: "isApprovedForAll",
            args: [address as `0x${string}`, CONTRACTS.LBRouter as `0x${string}`],
            chainId: baseSepolia.id,
          },
        ]
      : [],
  })

  // Extract contract token addresses and approval status
  const contractTokenX = poolContractData?.[0]?.status === "success"
    ? (poolContractData[0].result as string)
    : undefined
  const contractTokenY = poolContractData?.[1]?.status === "success"
    ? (poolContractData[1].result as string)
    : undefined
  const isApprovedForRouter = poolContractData?.[2]?.status === "success"
    ? (poolContractData[2].result as boolean)
    : false

  // Handle approval for LBPair (TraderJoe V2 uses approveForAll, not setApprovalForAll)
  const handleApprove = async () => {
    if (!selectedPool?.pairAddress) return

    try {
      const hash = await writeContractAsync({
        address: selectedPool.pairAddress,
        abi: LBPairABI,
        functionName: "approveForAll",
        args: [CONTRACTS.LBRouter as `0x${string}`, true],
      })

      setTxHash(hash)
      toast({ title: "Approval submitted", description: "Waiting for confirmation..." })

      // Wait for confirmation
      const { waitForTransactionReceipt } = await import("wagmi/actions")
      const { wagmiConfig } = await import("@/lib/web3/wagmi-config")
      await waitForTransactionReceipt(wagmiConfig, { hash })
      
      // Refetch approval status
      await refetchPoolData()
      
      toast({ title: "Approval confirmed", description: "You can now remove liquidity" })
    } catch (error: any) {
      console.error("Approval error:", error)
      toast({ title: "Approval failed", description: error.message, variant: "destructive" })
    }
  }

  // Validate slippage
  const validateSlippage = (slip: string): string | null => {
    if (!slip || slip.trim() === "") {
      return "Slippage is required"
    }

    const num = Number.parseFloat(slip)

    if (isNaN(num)) {
      return "Please enter a valid number"
    }

    if (num < 0.01) {
      return "Slippage too low (min 0.01%)"
    }

    if (num > 50) {
      return "Slippage too high (max 50%)"
    }

    return null
  }

  const handleSlippageChange = (value: string) => {
    setSlippage(value)
    const error = validateSlippage(value)
    setSlippageError(error)
  }

  // Auto-select all bins when positions load or pool changes
  useMemo(() => {
    if (positions.length > 0) {
      setBinRange([0, positions.length - 1])
    } else {
      setBinRange([0, 0])
    }
  }, [positions, selectedPoolId])

  // Calculate selected bins and values
  const selectedData = useMemo(() => {
    const selectedBins = positions.filter(
      (_, i) => i >= binRange[0] && i <= binRange[1]
    )

    const totalBalance = selectedBins.reduce((sum, b) => sum + b.balance, BigInt(0))
    const adjustedBalance = (totalBalance * BigInt(percentage[0])) / BigInt(100)

    // Calculate actual token amounts using percentage
    // positions.amountX/Y already contain the correct (userBalance/totalSupply) * binReserve
    let estimatedX = BigInt(0)
    let estimatedY = BigInt(0)

    selectedBins.forEach(bin => {
      // Apply percentage to user's actual share
      const portionX = (bin.amountX * BigInt(percentage[0])) / BigInt(100)
      const portionY = (bin.amountY * BigInt(percentage[0])) / BigInt(100)

      estimatedX += portionX
      estimatedY += portionY
    })

    return {
      bins: selectedBins,
      count: selectedBins.length,
      totalBalance: adjustedBalance,
      estimatedX,
      estimatedY,
    }
  }, [positions, binRange, percentage])

  const handleRemoveLiquidity = async () => {
    if (!tokenX || !tokenY || !address || selectedData.count === 0) return

    // CRITICAL: Use contract token order, not UI order
    if (!contractTokenX || !contractTokenY) {
      toast({
        title: "Pool bilgileri yükleniyor",
        description: "Lütfen birkaç saniye bekleyin ve tekrar deneyin.",
        variant: "destructive",
      })
      return
    }

    try {
      const selectedBins = positions.filter(
        (_, i) => i >= binRange[0] && i <= binRange[1]
      )

      // Extract bin IDs and calculate amounts
      const ids = selectedBins.map(b => BigInt(b.binId))
      const amounts = selectedBins.map(b => (b.balance * BigInt(percentage[0])) / BigInt(100))

      // CRITICAL: selectedData.estimatedX and estimatedY are ALREADY in CONTRACT order
      // because use-user-liquidity fetches binReserveX/Y directly from the contract
      // NO SWAP NEEDED - just apply slippage
      const slippageMultiplier = BigInt(Math.floor((100 - Number.parseFloat(slippage)) * 100))
      const finalAmountXMin = (selectedData.estimatedX * slippageMultiplier) / BigInt(10000)
      const finalAmountYMin = (selectedData.estimatedY * slippageMultiplier) / BigInt(10000)

      // Determine if UI token order matches contract token order (for logging only)
      const tokenXIsContractX = tokenX.address.toLowerCase() === contractTokenX.toLowerCase()

      console.log("🗑️ Removing liquidity:")
      console.log("  Contract tokenX:", contractTokenX)
      console.log("  Contract tokenY:", contractTokenY)
      console.log("  UI tokenX:", tokenX.address)
      console.log("  UI tokenY:", tokenY.address)
      console.log("  tokenXIsContractX:", tokenXIsContractX)
      console.log("  Bin IDs:", ids.map(id => id.toString()))
      console.log("  Amounts:", amounts.map(amt => amt.toString()))
      console.log("  Percentage:", percentage[0] + "%")
      console.log("  Estimated X (UI):", selectedData.estimatedX.toString())
      console.log("  Estimated Y (UI):", selectedData.estimatedY.toString())
      console.log("  Final Min X (contract order):", finalAmountXMin.toString())
      console.log("  Final Min Y (contract order):", finalAmountYMin.toString())

      const hash = await writeContractAsync({
        address: CONTRACTS.LBRouter as `0x${string}`,
        abi: LBRouterABI,
        functionName: "removeLiquidity",
        args: [
          contractTokenX as `0x${string}`,  // Use contract token order
          contractTokenY as `0x${string}`,  // Use contract token order
          selectedPool?.binStep || 25,
          finalAmountXMin,
          finalAmountYMin,
          ids,
          amounts,
          address,
          BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 min deadline
        ],
      })

      setTxHash(hash)

      // Add to transaction history
      addTransaction({
        type: "remove_liquidity",
        status: "pending",
        hash,
        poolInfo: {
          tokenX: tokenX.symbol,
          tokenY: tokenY.symbol,
          binStep: selectedPool?.binStep || 25,
        },
      })

      toast({ title: "Liquidity removal submitted", description: "Waiting for confirmation..." })
    } catch (error: any) {
      console.error("Remove liquidity error:", error)
      toast({ title: "Remove liquidity failed", description: error.message, variant: "destructive" })
    }
  }

  if (isLoadingPools) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="mr-2" />
        <span>Loading pools...</span>
      </div>
    )
  }

  if (pools.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground mb-2">No pools found</p>
        <p className="text-sm text-muted-foreground">
          No liquidity pools are available at the moment.
        </p>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="mr-2" />
        <span>Loading your liquidity positions...</span>
      </div>
    )
  }

  if (positions.length === 0 && selectedPool) {
    return (
      <div className="space-y-4">
        {/* Pool Selector */}
        <Card className="p-4">
          <Label className="text-sm mb-2 block">Select Pool</Label>
          <Select value={selectedPoolId || ""} onValueChange={setSelectedPoolId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a pool" />
            </SelectTrigger>
            <SelectContent>
              {pools.map((pool) => (
                <SelectItem key={pool.id} value={pool.id}>
                  {pool.tokenX.symbol} / {pool.tokenY.symbol} (Bin Step: {pool.binStep})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-2">No liquidity positions found</p>
          <p className="text-sm text-muted-foreground">
            You don't have any liquidity in the {selectedPool.tokenX.symbol}/{selectedPool.tokenY.symbol} pool yet.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Pool Selector */}
      <Card className="p-4">
        <Label className="text-sm mb-2 block">Select Pool</Label>
        <Select value={selectedPoolId || ""} onValueChange={setSelectedPoolId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a pool" />
          </SelectTrigger>
          <SelectContent>
            {pools.map((pool) => (
              <SelectItem key={pool.id} value={pool.id}>
                {pool.tokenX.symbol} / {pool.tokenY.symbol} (Bin Step: {pool.binStep})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT: Chart for bin selection */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Select Bins to Remove</CardTitle>
              <Badge variant="secondary">{selectedData.count} bins selected</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Visual Bin Chart */}
            <div className="h-[220px] flex items-end justify-center gap-0.5 mb-4 px-2 overflow-x-auto">
              {positions.map((bin, i) => {
                const isSelected = i >= binRange[0] && i <= binRange[1]
                const balanceNormalized = Number(formatUnits(bin.balance, 18))
                const height = Math.min(balanceNormalized * 50 + 10, 100)
                const isActiveId = bin.binId === activeId

                return (
                  <div
                    key={bin.binId}
                    className={cn(
                      "min-w-[8px] rounded-t transition-all cursor-pointer hover:opacity-100",
                      isSelected
                        ? bin.binId >= (activeId || 0) ? "bg-blue-500" : "bg-green-500"
                        : "bg-muted-foreground/20",
                      isActiveId && "ring-2 ring-primary ring-offset-1"
                    )}
                    style={{
                      height: `${height}%`,
                      opacity: isSelected ? 1 : 0.4
                    }}
                    title={`Bin ${bin.binId}: ${formatUnits(bin.balance, 18)} shares`}
                  />
                )
              })}
            </div>

            {/* Range Slider */}
            <div className="space-y-3">
              <Slider
                value={binRange}
                onValueChange={setBinRange}
                min={0}
                max={Math.max(0, positions.length - 1)}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Bin {positions[binRange[0]]?.binId || 0}</span>
                <span className="text-primary font-medium">Drag to select range</span>
                <span>Bin {positions[binRange[1]]?.binId || 0}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-muted-foreground/30" />
                <span className="text-muted-foreground">Not Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-muted-foreground">{tokenY?.symbol} bins</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-muted-foreground">{tokenX?.symbol} bins</span>
              </div>
              {activeId && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary ring-2 ring-primary ring-offset-1" />
                  <span className="text-muted-foreground">Active Bin</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Select Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBinRange([0, positions.length - 1])}
            className="flex-1"
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const activeIndex = positions.findIndex(p => p.binId === activeId)
              if (activeIndex > 0) setBinRange([0, activeIndex - 1])
            }}
            className="flex-1"
          >
            Below Active
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const activeIndex = positions.findIndex(p => p.binId === activeId)
              if (activeIndex >= 0 && activeIndex < positions.length - 1) {
                setBinRange([activeIndex + 1, positions.length - 1])
              }
            }}
            className="flex-1"
          >
            Above Active
          </Button>
        </div>
      </div>

      {/* RIGHT: Summary and Actions */}
      <div className="lg:col-span-2 space-y-4">
        {/* Token Pair Info */}
        <Card className="p-4 bg-muted/30 border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex -space-x-2">
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white border-2 border-background">
                {tokenX?.symbol.slice(0, 2)}
              </div>
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold text-white border-2 border-background">
                {tokenY?.symbol.slice(0, 2)}
              </div>
            </div>
            <div>
              <p className="font-medium">{tokenX?.symbol} / {tokenY?.symbol}</p>
              <p className="text-xs text-muted-foreground">
                {positions.length} bins with liquidity
              </p>
              <p className="text-xs text-muted-foreground">
                Bin Step: {selectedPool?.binStep}
              </p>
            </div>
          </div>
        </Card>

        {/* Percentage Slider */}
        <Card className="p-4 bg-muted/30 border-border/50">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm">Removal Percentage</Label>
              <span className="text-lg font-bold">{percentage[0]}%</span>
            </div>
            <Slider
              value={percentage}
              onValueChange={setPercentage}
              min={1}
              max={100}
              step={1}
            />
            <div className="flex gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <Button
                  key={pct}
                  variant={percentage[0] === pct ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPercentage([pct])}
                  className="flex-1"
                >
                  {pct}%
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Slippage Tolerance */}
        <Card className="p-4 bg-muted/30 border-border/50">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm">Slippage Tolerance</Label>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={slippage}
                    onChange={(e) => handleSlippageChange(e.target.value)}
                    className={`w-16 h-8 text-center text-sm ${slippageError ? "border-red-500" : ""}`}
                    step="0.1"
                    min="0.01"
                    max="50"
                  />
                  <span className="text-sm">%</span>
                </div>
                {slippageError && (
                  <p className="text-[10px] text-red-500">{slippageError}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {["0.1", "0.5", "1.0", "3.0"].map((slip) => (
                <Button
                  key={slip}
                  variant={slippage === slip ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSlippageChange(slip)}
                  className="flex-1"
                >
                  {slip}%
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-4 bg-muted/30 border-border/50">
          <h4 className="text-sm font-medium mb-3">Estimated Removal</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center p-2 bg-background/50 rounded">
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {tokenX?.symbol.slice(0, 1)}
                </div>
                {tokenX?.symbol}
              </span>
              <span className="font-mono font-bold">
                {formatUnits(selectedData.estimatedX, tokenX?.decimals || 18).slice(0, 8)}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-background/50 rounded">
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {tokenY?.symbol.slice(0, 1)}
                </div>
                {tokenY?.symbol}
              </span>
              <span className="font-mono font-bold">
                {formatUnits(selectedData.estimatedY, tokenY?.decimals || 18).slice(0, 8)}
              </span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Minimum {tokenX?.symbol} (with {slippage}% slippage)</span>
              <span className="font-medium">
                {formatUnits(
                  (selectedData.estimatedX * BigInt(Math.floor((100 - Number.parseFloat(slippage)) * 100))) / BigInt(10000),
                  tokenX?.decimals || 18
                ).slice(0, 8)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Minimum {tokenY?.symbol} (with {slippage}% slippage)</span>
              <span className="font-medium">
                {formatUnits(
                  (selectedData.estimatedY * BigInt(Math.floor((100 - Number.parseFloat(slippage)) * 100))) / BigInt(10000),
                  tokenY?.decimals || 18
                ).slice(0, 8)}
              </span>
            </div>
          </div>
        </Card>

        {/* Action Button */}
        {!isConnected ? (
          <Button className="w-full h-12 text-base bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
            Connect Wallet
          </Button>
        ) : !isApprovedForRouter && selectedData.count > 0 ? (
          <Button
            className="w-full h-12 text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            onClick={handleApprove}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Spinner className="mr-2" />
                Approving...
              </>
            ) : (
              "Approve LBPair for Router"
            )}
          </Button>
        ) : (
          <Button
            className="w-full h-12 text-base bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
            onClick={handleRemoveLiquidity}
            disabled={isProcessing || selectedData.count === 0 || !!slippageError}
          >
            {isProcessing ? (
              <>
                <Spinner className="mr-2" />
                Removing...
              </>
            ) : slippageError ? (
              "Invalid Slippage"
            ) : selectedData.count === 0 ? (
              "Select Bins"
            ) : (
              `Remove from ${selectedData.count} Bins`
            )}
          </Button>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          Liquidity will be removed from selected bins based on the percentage.
        </p>
      </div>
      </div>
    </div>
  )
}
