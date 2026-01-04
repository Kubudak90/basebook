"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TokenSelect } from "@/components/swap/token-select"
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts } from "wagmi"
import { LBRouterABI, ERC20ABI, LBPairABI } from "@/lib/contracts/abis"
import { baseSepolia } from "wagmi/chains"
import { useTokenBalance } from "@/lib/hooks/use-token-balance"
import { useTokenAllowance } from "@/lib/hooks/use-token-allowance"
import { parseUnits } from "viem"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { StrategySelector, StrategyType } from "./strategy-selector"
import { LiquidityChart } from "./liquidity-chart"
import { usePrices } from "@/hooks/use-prices"
import { useTransactionHistory } from "@/hooks/use-transaction-history"
import { readContract, waitForTransactionReceipt } from "wagmi/actions"
import { wagmiConfig } from "@/lib/web3/wagmi-config"
import { logger } from "@/lib/utils/logger"

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
}

interface AddLiquidityProps {
  // Optional pool tokens - when provided, tokens are fixed (no selection)
  poolTokenX?: { address?: string; symbol: string; decimals?: number }
  poolTokenY?: { address?: string; symbol: string; decimals?: number }
  poolBinStep?: number
  poolPairAddress?: `0x${string}`
}

export function AddLiquidity({ poolTokenX, poolTokenY, poolBinStep, poolPairAddress }: AddLiquidityProps) {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()
  const { addTransaction, updateTransaction } = useTransactionHistory()

  // Check if we're in pool context (tokens fixed)
  const isPoolContext = !!(poolTokenX && poolTokenY)

  // Resolve pool tokens to full Token objects if in pool context
  const resolvePoolToken = (poolToken: { address?: string; symbol: string; decimals?: number } | undefined): Token | null => {
    if (!poolToken) return null
    // Try to find token in TOKENS list
    const found = Object.values(TOKENS).find(t =>
      t.symbol.toLowerCase() === poolToken.symbol.toLowerCase() ||
      (poolToken.address && t.address.toLowerCase() === poolToken.address.toLowerCase())
    )
    if (found) return found
    // Return a basic token if not found in list
    return {
      address: poolToken.address || "",
      symbol: poolToken.symbol,
      name: poolToken.symbol,
      decimals: poolToken.decimals || 18,
      logoURI: "",
    }
  }

  // Token states - use pool tokens if in pool context
  const [tokenX, setTokenX] = useState<Token | null>(isPoolContext ? resolvePoolToken(poolTokenX) : TOKENS.WETH)
  const [tokenY, setTokenY] = useState<Token | null>(isPoolContext ? resolvePoolToken(poolTokenY) : TOKENS.USDC)
  const [amountX, setAmountX] = useState("")
  const [amountY, setAmountY] = useState("")

  // Update tokens if pool context changes
  useEffect(() => {
    if (isPoolContext) {
      setTokenX(resolvePoolToken(poolTokenX))
      setTokenY(resolvePoolToken(poolTokenY))
    }
  }, [isPoolContext, poolTokenX?.symbol, poolTokenY?.symbol])

  // Strategy & Range states
  const [strategy, setStrategy] = useState<StrategyType>("curve")
  const [binStep, setBinStep] = useState(poolBinStep || 25)

  // Fetch pool's real tokenX and tokenY addresses from the contract
  // CRITICAL: We MUST use the contract's token order, not UI order
  // Use useReadContracts to fetch all at once for better reliability
  const { data: poolContractData, isLoading: isLoadingPoolData } = useReadContracts({
    contracts: poolPairAddress
      ? [
          {
            address: poolPairAddress,
            abi: LBPairABI,
            functionName: "getTokenX",
            chainId: baseSepolia.id,
          },
          {
            address: poolPairAddress,
            abi: LBPairABI,
            functionName: "getTokenY",
            chainId: baseSepolia.id,
          },
          {
            address: poolPairAddress,
            abi: LBPairABI,
            functionName: "getActiveId",
            chainId: baseSepolia.id,
          },
        ]
      : [],
  })

  // Extract contract token addresses
  const contractTokenX = poolContractData?.[0]?.status === "success" 
    ? (poolContractData[0].result as string)
    : undefined
  const contractTokenY = poolContractData?.[1]?.status === "success"
    ? (poolContractData[1].result as string)
    : undefined
  const poolActiveId = poolContractData?.[2]?.status === "success"
    ? (poolContractData[2].result as bigint)
    : undefined

  // Debug: Log contract data status with full details
  useEffect(() => {
    if (poolPairAddress && poolContractData) {
      logger.log("🔍 Pool Contract Data Status (DETAILED):", {
        poolPairAddress,
        isLoading: isLoadingPoolData,
        dataLength: poolContractData.length,
        results: poolContractData.map((r, i) => {
          const funcName = i === 0 ? "tokenX" : i === 1 ? "tokenY" : "getActiveId"
          return {
            index: i,
            function: funcName,
            status: r?.status,
            error: r?.error,
            result: r?.result,
            fullResult: r,
          }
        }),
        extracted: {
          contractTokenX,
          contractTokenY,
          poolActiveId,
        },
      })
      
      // Log why extraction failed
      if (!contractTokenX || !contractTokenY) {
        logger.error("❌ Extraction failed - Details:", {
          firstResult: poolContractData[0],
          secondResult: poolContractData[1],
          firstStatus: poolContractData[0]?.status,
          secondStatus: poolContractData[1]?.status,
          firstError: poolContractData[0]?.error,
          secondError: poolContractData[1]?.error,
        })
      }
    }
  }, [poolPairAddress, poolContractData, isLoadingPoolData, contractTokenX, contractTokenY, poolActiveId])

  // Fetch live prices from CoinGecko
  const { getPrice, getPairPrice, isLoading: isPriceLoading } = usePrices(
    tokenX && tokenY ? [tokenX.symbol, tokenY.symbol] : []
  )

  // Calculate current price from CoinGecko
  // CRITICAL: Price must be "tokenY per tokenX" (how many tokenY for 1 tokenX)
  // But we need to account for token sorting (tokenX < tokenY)
  const currentPrice = useMemo(() => {
    if (!tokenX || !tokenY) return 0.0004 // Fallback
    
    // Get price: 1 tokenX = ? tokenY
    const pairPrice = getPairPrice(tokenX.symbol, tokenY.symbol)
    if (!pairPrice) return 0.0004 // Fallback if price not available
    
    // Determine final token order (contract order)
    let finalTokenX: Token
    let finalTokenY: Token
    
    if (contractTokenX && contractTokenY) {
      // Use contract order
      const tokenXIsContractX = tokenX.address.toLowerCase() === contractTokenX.toLowerCase()
      finalTokenX = tokenXIsContractX ? tokenX : tokenY
      finalTokenY = tokenXIsContractX ? tokenY : tokenX
    } else if (poolTokenX?.address && poolTokenY?.address) {
      // Fallback: sort by address
      const tokenXAddr = poolTokenX.address.toLowerCase()
      const tokenYAddr = poolTokenY.address.toLowerCase()
      finalTokenX = tokenXAddr < tokenYAddr ? tokenX : tokenY
      finalTokenY = tokenXAddr < tokenYAddr ? tokenY : tokenX
    } else {
      // Fallback: sort by address
      const tokenXAddr = tokenX.address.toLowerCase()
      const tokenYAddr = tokenY.address.toLowerCase()
      finalTokenX = tokenXAddr < tokenYAddr ? tokenX : tokenY
      finalTokenY = tokenXAddr < tokenYAddr ? tokenY : tokenX
    }
    
    // Check if tokens need to be swapped (finalTokenX might be different from UI tokenX)
    const needsSwap = tokenX.address.toLowerCase() !== finalTokenX.address.toLowerCase()
    
    // If tokens are swapped, price must be inverted
    // Original: 1 tokenX = pairPrice tokenY
    // Swapped: 1 tokenY = pairPrice tokenX, so 1 tokenX = 1/pairPrice tokenY
    const finalPrice = needsSwap ? 1 / pairPrice : pairPrice
    
    return finalPrice
  }, [tokenX, tokenY, getPairPrice, contractTokenX, contractTokenY, poolTokenX?.address, poolTokenY?.address])

  // Price range states - initialize with default, will be updated when currentPrice is calculated
  const [minPrice, setMinPrice] = useState(0.0003)
  const [maxPrice, setMaxPrice] = useState(0.0005)
  const [volatilityPercent, setVolatilityPercent] = useState(50)
  const [numBins, setNumBins] = useState(10)

  // Update price range when currentPrice changes
  useEffect(() => {
    if (currentPrice > 0) {
      setMinPrice(currentPrice * 0.75)
      setMaxPrice(currentPrice * 1.25)
    }
  }, [currentPrice])

  const { formattedBalance: balanceX } = useTokenBalance(tokenX?.address as `0x${string}`)
  const { formattedBalance: balanceY } = useTokenBalance(tokenY?.address as `0x${string}`)

  // CRITICAL: Get allowances for BOTH UI tokens (tokenX and tokenY)
  // This ensures both tokens are approved regardless of contract order
  const { allowance: allowanceX, refetch: refetchAllowanceX } = useTokenAllowance(
    tokenX?.address as `0x${string}`,
    CONTRACTS.LBRouter as `0x${string}`,
  )
  const { allowance: allowanceY, refetch: refetchAllowanceY } = useTokenAllowance(
    tokenY?.address as `0x${string}`,
    CONTRACTS.LBRouter as `0x${string}`,
  )

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
        title: "Liquidity added successfully",
        description: "Your liquidity has been added to the pool",
      })
    } else if (isError) {
      updateTransaction(txHash, { status: "failed", errorMessage: "Transaction failed" })
    }
  }, [txHash, isSuccess, isError, updateTransaction, toast])

  // Calculate distribution based on strategy
  // CRITICAL: In Trader Joe, bins with ID > activeId get tokenX, bins with ID < activeId get tokenY
  // Active bin (ID == activeId) gets BOTH tokens (50-50 split)
  // IMPORTANT: Each side (X and Y) must sum to 1e18 INDEPENDENTLY!
  const getDistribution = useMemo(() => {
    // numBins comes from state
    const deltaIds = Array.from({ length: numBins }, (_, i) => i - Math.floor(numBins / 2))

    // Calculate base distribution weights based on strategy
    let weights: number[] = []

    switch (strategy) {
      case "spot":
        // Uniform distribution
        weights = Array(numBins).fill(1)
        break
      case "curve":
        // Gaussian/concentrated distribution
        const center = numBins / 2
        const sigma = numBins / 4
        weights = Array.from({ length: numBins }, (_, i) => {
          const x = i - center
          return Math.exp(-(x * x) / (2 * sigma * sigma))
        })
        break
      case "bidask":
        // U-shape distribution (edges heavy)
        weights = Array.from({ length: numBins }, (_, i) => {
          const normalized = (i - (numBins - 1) / 2) / ((numBins - 1) / 2)
          return normalized * normalized + 0.1
        })
        break
    }

    const PRECISION_BI = BigInt("1000000000000000000") // 1e18

    // CRITICAL FIX: Separate weights by token type FIRST, then normalize EACH SIDE to 1e18
    // Active bin gets 50-50 split (weight/2 to each side)
    const weightsX: number[] = []
    const weightsY: number[] = []

    for (let i = 0; i < numBins; i++) {
      const deltaId = deltaIds[i]
      const weight = weights[i]

      if (deltaId < 0) {
        // Bins below active → tokenY only
        weightsY.push(weight)
        weightsX.push(0)
      } else if (deltaId > 0) {
        // Bins above active → tokenX only
        weightsX.push(weight)
        weightsY.push(0)
      } else {
        // Active bin (deltaId === 0) → split 50-50 (TraderJoe V2 standard)
        weightsX.push(weight / 2)
        weightsY.push(weight / 2)
      }
    }

    // Normalize X weights to sum to 1e18
    const sumX = weightsX.reduce((a, b) => a + b, 0)
    const distributionX: string[] = weightsX.map(w => {
      if (sumX === 0 || w === 0) return "0"
      const ratio = w / sumX
      const ratioBig = Math.floor(ratio * 1e9)
      return (BigInt(ratioBig) * BigInt(1e9)).toString()
    })

    // Normalize Y weights to sum to 1e18
    const sumY = weightsY.reduce((a, b) => a + b, 0)
    const distributionY: string[] = weightsY.map(w => {
      if (sumY === 0 || w === 0) return "0"
      const ratio = w / sumY
      const ratioBig = Math.floor(ratio * 1e9)
      return (BigInt(ratioBig) * BigInt(1e9)).toString()
    })

    // Adjust sums to ensure each equals exactly 1e18
    const currentSumX = distributionX.reduce((a, b) => BigInt(a) + BigInt(b), BigInt(0))
    const diffX = PRECISION_BI - currentSumX
    if (diffX !== BigInt(0)) {
      // Add diff to first non-zero X bin
      const firstNonZeroX = distributionX.findIndex(x => x !== "0")
      if (firstNonZeroX >= 0) {
        distributionX[firstNonZeroX] = (BigInt(distributionX[firstNonZeroX]) + diffX).toString()
      }
    }

    const currentSumY = distributionY.reduce((a, b) => BigInt(a) + BigInt(b), BigInt(0))
    const diffY = PRECISION_BI - currentSumY
    if (diffY !== BigInt(0)) {
      // Add diff to first non-zero Y bin
      const firstNonZeroY = distributionY.findIndex(y => y !== "0")
      if (firstNonZeroY >= 0) {
        distributionY[firstNonZeroY] = (BigInt(distributionY[firstNonZeroY]) + diffY).toString()
      }
    }

    return { deltaIds, distributionX, distributionY, numBins }
  }, [strategy, numBins])

  // CRITICAL FIX: Check approvals for UI tokens (tokenX and tokenY)
  // This ensures BOTH tokens are approved before addLiquidity, regardless of contract order
  const needsApprovalX = () => {
    if (!amountX || !tokenX) return false
    try {
      const amount = parseUnits(amountX, tokenX.decimals)
      return (allowanceX as bigint) < amount
    } catch {
      return false
    }
  }

  const needsApprovalY = () => {
    if (!amountY || !tokenY) return false
    try {
      const amount = parseUnits(amountY, tokenY.decimals)
      return (allowanceY as bigint) < amount
    } catch {
      return false
    }
  }

  // Validate amounts
  const hasValidInputs = () => {
    if (!amountX || !amountY) return false

    try {
      const numX = Number.parseFloat(amountX)
      const numY = Number.parseFloat(amountY)

      if (isNaN(numX) || isNaN(numY)) return false
      if (numX <= 0 || numY <= 0) return false

      // Check against balances
      if (balanceX && balanceY) {
        const balX = Number.parseFloat(balanceX)
        const balY = Number.parseFloat(balanceY)
        if (numX > balX || numY > balY) return false
      }

      return true
    } catch {
      return false
    }
  }

  // Approve UI tokenX (whichever token is shown as tokenX in UI)
  const handleApproveX = async () => {
    if (!tokenX || !amountX) return
    try {
      // Approve max uint256 to avoid repeated approvals (common DEX pattern)
      const approvalAmount = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
      const hash = await writeContractAsync({
        address: tokenX.address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "approve",
        args: [CONTRACTS.LBRouter, approvalAmount],
      })
      setTxHash(hash)
      toast({ title: "Approval submitted", description: `Waiting for ${tokenX.symbol} confirmation...` })
      // Wait for transaction confirmation before refetching
      await waitForTransactionReceipt(wagmiConfig, { hash })
      await refetchAllowanceX()
      toast({ title: "Approval confirmed", description: `${tokenX.symbol} approved successfully` })
    } catch (error: any) {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" })
    }
  }

  // Approve UI tokenY (whichever token is shown as tokenY in UI)
  const handleApproveY = async () => {
    if (!tokenY || !amountY) return
    try {
      // Approve max uint256 to avoid repeated approvals (common DEX pattern)
      const approvalAmount = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
      const hash = await writeContractAsync({
        address: tokenY.address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "approve",
        args: [CONTRACTS.LBRouter, approvalAmount],
      })
      setTxHash(hash)
      toast({ title: "Approval submitted", description: `Waiting for ${tokenY.symbol} confirmation...` })
      // Wait for transaction confirmation before refetching
      await waitForTransactionReceipt(wagmiConfig, { hash })
      await refetchAllowanceY()
      toast({ title: "Approval confirmed", description: `${tokenY.symbol} approved successfully` })
    } catch (error: any) {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" })
    }
  }

  const handleAddLiquidity = async () => {
    if (!tokenX || !tokenY || !amountX || !amountY || !address) return

    // CRITICAL: If we have a pool address, we MUST use contract's token order
    // LBRouter checks: liquidityParameters.tokenX == lbPair.getTokenX()
    // But if contract data is still loading, wait a bit
    if (poolPairAddress && isLoadingPoolData) {
      toast({
        title: "Pool bilgileri yükleniyor",
        description: "Lütfen birkaç saniye bekleyin ve tekrar deneyin.",
        variant: "destructive",
      })
      return
    }

    // CRITICAL: We MUST use contract's token order
    // If contract data is not available, try to use pool token addresses with correct sorting
    let finalContractTokenX: string | undefined
    let finalContractTokenY: string | undefined
    let finalTokenX: Token | null = null
    let finalTokenY: Token | null = null
    let finalAmountX: string = ""
    let finalAmountY: string = ""

    if (contractTokenX && contractTokenY) {
      // Use contract's token addresses (BEST - most reliable)
      finalContractTokenX = contractTokenX
      finalContractTokenY = contractTokenY
      logger.log("✅ Using contract token addresses")
      
      // Determine which UI token matches contractTokenX
      const tokenXIsContractX = tokenX.address.toLowerCase() === contractTokenX.toLowerCase()
      finalTokenX = tokenXIsContractX ? tokenX : tokenY
      finalTokenY = tokenXIsContractX ? tokenY : tokenX
      finalAmountX = tokenXIsContractX ? amountX : amountY
      finalAmountY = tokenXIsContractX ? amountY : amountX
    } else if (poolTokenX?.address && poolTokenY?.address) {
      // Fallback: Use pool token addresses but sort them correctly (tokenX < tokenY)
      // CRITICAL: LBRouter expects tokenX < tokenY (address comparison)
      const tokenXAddr = poolTokenX.address.toLowerCase()
      const tokenYAddr = poolTokenY.address.toLowerCase()
      
      // Sort: tokenX must be < tokenY
      if (tokenXAddr < tokenYAddr) {
        finalContractTokenX = poolTokenX.address
        finalContractTokenY = poolTokenY.address
        finalTokenX = tokenX
        finalTokenY = tokenY
        finalAmountX = amountX
        finalAmountY = amountY
      } else {
        // Swap order: pool'un UI'daki tokenX'i aslında contract'ta tokenY olabilir
        finalContractTokenX = poolTokenY.address
        finalContractTokenY = poolTokenX.address
        finalTokenX = tokenY
        finalTokenY = tokenX
        finalAmountX = amountY
        finalAmountY = amountX
      }
      logger.warn("⚠️ Using fallback token addresses (contract call failed):", {
        finalContractTokenX,
        finalContractTokenY,
        originalX: poolTokenX.address,
        originalY: poolTokenY.address,
        note: "Token order sorted by address (tokenX < tokenY)",
      })
    } else {
      toast({
        title: "Pool bilgileri yüklenemedi",
        description: "Pool kontratından token bilgileri alınamadı. Lütfen sayfayı yenileyin.",
        variant: "destructive",
      })
      logger.error("❌ Contract token data missing:", {
        contractTokenX,
        contractTokenY,
        poolTokenX: poolTokenX?.address,
        poolTokenY: poolTokenY?.address,
        poolPairAddress,
        poolContractData,
      })
      return
    }

    // CRITICAL: Check approvals for the FINAL token order (contract order)
    // Approval'lar final token sırasına göre kontrol edilmeli
    if (!finalTokenX || !finalTokenY || !finalAmountX || !finalAmountY) {
      toast({
        title: "Hata",
        description: "Token bilgileri eksik.",
        variant: "destructive",
      })
      return
    }

    // CRITICAL: Check approvals for final tokens by reading directly from contract
    // This ensures we have the latest allowance values
    const finalAmountXBig = parseUnits(finalAmountX, finalTokenX.decimals)
    const finalAmountYBig = parseUnits(finalAmountY, finalTokenY.decimals)

    let finalTokenXAllowance: bigint
    let finalTokenYAllowance: bigint

    try {
      const [allowanceXResult, allowanceYResult] = await Promise.all([
        readContract(wagmiConfig, {
          address: finalTokenX.address as `0x${string}`,
          abi: ERC20ABI,
          functionName: "allowance",
          args: [address, CONTRACTS.LBRouter as `0x${string}`],
        }),
        readContract(wagmiConfig, {
          address: finalTokenY.address as `0x${string}`,
          abi: ERC20ABI,
          functionName: "allowance",
          args: [address, CONTRACTS.LBRouter as `0x${string}`],
        }),
      ])

      // Type guard for bigint results
      if (typeof allowanceXResult !== 'bigint' || typeof allowanceYResult !== 'bigint') {
        throw new Error('Invalid allowance result type')
      }

      finalTokenXAllowance = allowanceXResult
      finalTokenYAllowance = allowanceYResult
      
      logger.log("🔍 Approval Check (DIRECT CONTRACT READ):", {
        finalTokenX: finalTokenX.address,
        finalTokenY: finalTokenY.address,
        finalTokenXAllowance: finalTokenXAllowance.toString(),
        finalTokenYAllowance: finalTokenYAllowance.toString(),
        finalAmountXBig: finalAmountXBig.toString(),
        finalAmountYBig: finalAmountYBig.toString(),
        needsApprovalX: finalTokenXAllowance < finalAmountXBig,
        needsApprovalY: finalTokenYAllowance < finalAmountYBig,
      })
      
      if (finalTokenXAllowance < finalAmountXBig || finalTokenYAllowance < finalAmountYBig) {
        toast({
          title: "Approval gerekli",
          description: `Lütfen önce token'ları onaylayın. ${finalTokenX?.symbol} veya ${finalTokenY?.symbol} için yeterli izin yok.`,
          variant: "destructive",
        })
        return
      }
    } catch (error: any) {
      logger.error("❌ Failed to read allowances:", error)
      toast({
        title: "Hata",
        description: "Allowance kontrolü yapılamadı. Lütfen tekrar deneyin.",
        variant: "destructive",
      })
      return
    }

    try {
      // Convert amounts to bigint using final token decimals
      const amtX = parseUnits(finalAmountX, finalTokenX.decimals)
      const amtY = parseUnits(finalAmountY, finalTokenY.decimals)

      const { deltaIds } = getDistribution

      // Determine token order for the contract (already determined above)
      // Use finalContractTokenX and finalContractTokenY which are already set
      const finalTokenXAddr = finalContractTokenX as string
      const finalTokenYAddr = finalContractTokenY as string

      // Debug logs
      logger.log("🔍 DEBUG - Token Order Check:")
      logger.log("  poolPairAddress:", poolPairAddress)
      logger.log("  contractTokenX:", contractTokenX || "Using fallback:", finalContractTokenX)
      logger.log("  contractTokenY:", contractTokenY || "Using fallback:", finalContractTokenY)
      logger.log("  UI tokenX.address:", tokenX.address)
      logger.log("  UI tokenY.address:", tokenY.address)
      logger.log("  Final tokenX:", finalTokenX?.symbol, finalTokenXAddr)
      logger.log("  Final tokenY:", finalTokenY?.symbol, finalTokenYAddr)

      // Check which UI token matches contractTokenX to determine amounts
      const tokenXIsContractX = tokenX.address.toLowerCase() === finalTokenXAddr.toLowerCase()
      logger.log("  tokenXIsContractX:", tokenXIsContractX)

      // finalAmountX and finalAmountY are ALREADY in contract order (swapped at line 417-418)
      // So amtX and amtY are already correct - NO NEED TO SWAP AGAIN!
      const finalAmountXBig = amtX
      const finalAmountYBig = amtY

      // CRITICAL: Distribution is calculated based on deltaId, NOT token identity
      // deltaId < 0 → distributionY (bins below active need more tokenY)
      // deltaId >= 0 → distributionX (bins at/above active need more tokenX)
      // This logic is independent of token order - no swap needed!
      // Amount swap handles the token order difference, distribution stays the same.
      const finalDistributionX = [...getDistribution.distributionX]
      const finalDistributionY = [...getDistribution.distributionY]
      
      logger.log("🔍 Distribution Check:", {
        deltaIds,
        finalDistributionX,
        finalDistributionY,
        tokenXIsContractX,
        note: "Distribution based on deltaId - no swap needed"
      })

      logger.log("  ✅ Final tokenX:", finalTokenXAddr)
      logger.log("  ✅ Final tokenY:", finalTokenYAddr)
      logger.log("  ✅ Final amountX (contract order):", finalAmountXBig.toString())
      logger.log("  ✅ Final amountY (contract order):", finalAmountYBig.toString())

      // Use fetched activeId or fallback to center bin
      const activeIdToUse = poolActiveId ? BigInt(poolActiveId) : BigInt(8388608)
      
      logger.log("🔍 Final Contract Data:")
      logger.log("  contractTokenX:", contractTokenX)
      logger.log("  contractTokenY:", contractTokenY)
      logger.log("  poolActiveId:", poolActiveId)

      const liquidityParams = {
        tokenX: finalTokenXAddr as `0x${string}`,
        tokenY: finalTokenYAddr as `0x${string}`,
        binStep: BigInt(binStep),
        amountX: finalAmountXBig,
        amountXMin: (finalAmountXBig * BigInt(95)) / BigInt(100),
        amountY: finalAmountYBig,
        amountYMin: (finalAmountYBig * BigInt(95)) / BigInt(100),
        activeIdDesired: activeIdToUse,
        idSlippage: BigInt(100), // Increased slippage for safety
        deltaIds: deltaIds.map(BigInt),
        distributionX: finalDistributionX.map(s => BigInt(s)),
        distributionY: finalDistributionY.map(s => BigInt(s)),
        to: address,
        refundTo: address,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
      }

      logger.log("📤 Sending transaction with params:")
      logger.log("  tokenX:", liquidityParams.tokenX)
      logger.log("  tokenY:", liquidityParams.tokenY)
      logger.log("  binStep:", liquidityParams.binStep.toString())

      const hash = await writeContractAsync({
        address: CONTRACTS.LBRouter as `0x${string}`,
        abi: LBRouterABI,
        functionName: "addLiquidity",
        args: [liquidityParams],
      })

      setTxHash(hash)

      // Add to transaction history
      addTransaction({
        type: "add_liquidity",
        status: "pending",
        hash,
        poolInfo: {
          tokenX: tokenX.symbol,
          tokenY: tokenY.symbol,
          binStep: binStep,
        },
      })

      toast({ title: "Liquidity added", description: "Transaction submitted" })
      setAmountX("")
      setAmountY("")
    } catch (error: any) {
      logger.error("❌ Transaction failed:", error)
      logger.error("❌ Error details:", {
        message: error.message,
        shortMessage: error.shortMessage,
        cause: error.cause,
        data: error.data,
        code: error.code,
        name: error.name,
        stack: error.stack,
      })
      
      // Extract more detailed error message
      let errorMessage = "Bilinmeyen hata"
      if (error.shortMessage) {
        errorMessage = error.shortMessage
      } else if (error.message) {
        errorMessage = error.message
      } else if (error.data?.message) {
        errorMessage = error.data.message
      } else if (error.cause?.message) {
        errorMessage = error.cause.message
      }
      
      toast({
        title: "Add liquidity failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* LEFT COLUMN (3/5): Chart + Stats + Price Range */}
      <div className="lg:col-span-3 space-y-3">
        {/* Liquidity Chart */}
        <LiquidityChart
          tokenX={tokenX}
          tokenY={tokenY}
          amountX={amountX}
          amountY={amountY}
          strategy={strategy}
          minPrice={minPrice}
          maxPrice={maxPrice}
          currentPrice={currentPrice}
          numBins={69}
        />

        {/* Performance Stats - Compact horizontal */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 bg-muted/30 border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Yıllık Getiri (APY)</p>
            <p className="text-lg font-bold text-green-400">23.46%</p>
            <p className="text-[10px] text-muted-foreground">Tahmini</p>
          </Card>
          <Card className="p-3 bg-muted/30 border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Günlük Ücret</p>
            <p className="text-lg font-bold">$0.64</p>
            <p className="text-[10px] text-muted-foreground">$1000 başına</p>
          </Card>
          <Card className="p-3 bg-muted/30 border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Geçici Kayıp (IL)</p>
            <p className="text-lg font-bold text-red-400">-0.76%</p>
            <p className="text-[10px] text-muted-foreground">Tahmini</p>
          </Card>
        </div>

        {/* Price Range - Editable Inputs + Slider */}
        <Card className="p-4 bg-muted/30 border-border/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Fiyat Aralığı</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Bin Sayısı</span>
              <Input
                type="number"
                value={numBins}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 10
                  setNumBins(Math.max(1, Math.min(100, val)))
                }}
                className="w-16 h-7 text-xs text-center font-mono"
                min={1}
                max={100}
              />
            </div>
          </div>

          {/* Range Slider */}
          <div className="space-y-4">
            <Slider
              value={[
                Math.round((minPrice / currentPrice) * 50),
                Math.round((maxPrice / currentPrice) * 50)
              ]}
              onValueChange={(values) => {
                setMinPrice((values[0] / 50) * currentPrice)
                setMaxPrice((values[1] / 50) * currentPrice)
              }}
              min={25}
              max={75}
              step={1}
              className="w-full"
            />

            {/* Min/Max Editable Inputs */}
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1 text-center">MIN FİYAT</p>
                <Input
                  type="number"
                  value={minPrice.toFixed(2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val > 0 && val < maxPrice) {
                      setMinPrice(val)
                    }
                  }}
                  onBlur={() => {
                    // Round to nearest bin on blur
                    if (binStep && currentPrice > 0) {
                      const pricePerBin = currentPrice * (binStep / 10000)
                      const roundedMin = Math.round(minPrice / pricePerBin) * pricePerBin
                      setMinPrice(Math.max(roundedMin, pricePerBin))
                    }
                  }}
                  className="h-10 text-center font-mono font-bold"
                  step="any"
                />
                <p className="text-[10px] text-muted-foreground text-center mt-1">{tokenY?.symbol} per {tokenX?.symbol}</p>
              </div>
              
              <div className="flex items-center justify-center pt-6">
                <div className="h-px w-8 bg-border" />
              </div>
              
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1 text-center">MAX FİYAT</p>
                <Input
                  type="number"
                  value={maxPrice.toFixed(2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val > minPrice) {
                      setMaxPrice(val)
                    }
                  }}
                  onBlur={() => {
                    // Round to nearest bin on blur
                    if (binStep && currentPrice > 0) {
                      const pricePerBin = currentPrice * (binStep / 10000)
                      const roundedMax = Math.round(maxPrice / pricePerBin) * pricePerBin
                      setMaxPrice(Math.max(roundedMax, minPrice + pricePerBin))
                    }
                  }}
                  className="h-10 text-center font-mono font-bold"
                  step="any"
                />
                <p className="text-[10px] text-muted-foreground text-center mt-1">{tokenY?.symbol} per {tokenX?.symbol}</p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setMinPrice(currentPrice * 0.9)
                  setMaxPrice(currentPrice * 1.1)
                }}
              >
                ±10%
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setMinPrice(currentPrice * 0.75)
                  setMaxPrice(currentPrice * 1.25)
                }}
              >
                ±25%
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setMinPrice(currentPrice * 0.5)
                  setMaxPrice(currentPrice * 1.5)
                }}
              >
                ±50%
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN (2/5): Strategy + Token Inputs + Summary + Button */}
      <div className="lg:col-span-2 space-y-3">
        {/* Strategy Selection - Horizontal */}
        <Card className="p-3 bg-muted/30 border-border/50">
          <Label className="text-sm font-medium mb-2 block">Strateji Seçimi</Label>
          <StrategySelector
            selectedStrategy={strategy}
            onSelectStrategy={setStrategy}
          />
        </Card>

        {/* Token Inputs */}
        <Card className="p-3 bg-muted/30 border-border/50">
          <Label className="text-sm font-medium mb-3 block">Yatırım Tutarı</Label>
          <div className="space-y-3">
            {/* Token X */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{tokenX?.symbol} Miktarı</span>
                <span className="text-muted-foreground">Bakiye: {balanceX}</span>
              </div>
              <div className="flex gap-2">
                {isPoolContext ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border border-border/50">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                      {tokenX?.symbol?.slice(0, 2)}
                    </div>
                    <span className="font-medium text-sm">{tokenX?.symbol}</span>
                  </div>
                ) : (
                  <TokenSelect selectedToken={tokenX} onSelectToken={setTokenX} excludeToken={tokenY} />
                )}
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amountX}
                  onChange={(e) => setAmountX(e.target.value)}
                  className="flex-1 font-mono text-right"
                />
              </div>
            </div>

            {/* Swap Arrow */}
            <div className="flex justify-center">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-xs">+</span>
              </div>
            </div>

            {/* Token Y */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{tokenY?.symbol} Miktarı</span>
                <span className="text-muted-foreground">Bakiye: {balanceY}</span>
              </div>
              <div className="flex gap-2">
                {isPoolContext ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border border-border/50">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-[10px] font-bold text-white">
                      {tokenY?.symbol?.slice(0, 2)}
                    </div>
                    <span className="font-medium text-sm">{tokenY?.symbol}</span>
                  </div>
                ) : (
                  <TokenSelect selectedToken={tokenY} onSelectToken={setTokenY} excludeToken={tokenX} />
                )}
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amountY}
                  onChange={(e) => setAmountY(e.target.value)}
                  className="flex-1 font-mono text-right"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-3 bg-muted/30 border-border/50">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Toplam Değer</span>
              <span className="font-medium">$0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ücret Seviyesi (Fee Tier)</span>
              <span className="font-medium">{(binStep / 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seçilen Bin Sayısı</span>
              <span className="font-medium">30</span>
            </div>
          </div>
        </Card>

        {/* Action Button */}
        {!isConnected ? (
          <Button className="w-full h-12 text-base bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
            Cüzdan Bağla
          </Button>
        ) : (
          <div className="space-y-2">
            {needsApprovalX() && (
              <Button className="w-full h-10" onClick={handleApproveX} disabled={isProcessing}>
                {isProcessing ? <><Spinner className="mr-2" />Onaylanıyor...</> : `${tokenX?.symbol} Onayla`}
              </Button>
            )}
            {needsApprovalY() && (
              <Button className="w-full h-10" onClick={handleApproveY} disabled={isProcessing}>
                {isProcessing ? <><Spinner className="mr-2" />Onaylanıyor...</> : `${tokenY?.symbol} Onayla`}
              </Button>
            )}
            {!needsApprovalX() && !needsApprovalY() && (
              <Button
                className="w-full h-12 text-base bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                onClick={handleAddLiquidity}
                disabled={!hasValidInputs() || isProcessing || (poolPairAddress && isLoadingPoolData)}
              >
                {isProcessing ? (
                  <><Spinner className="mr-2" />Ekleniyor...</>
                ) : poolPairAddress && isLoadingPoolData ? (
                  <><Spinner className="mr-2" />Pool bilgileri yükleniyor...</>
                ) : !hasValidInputs() ? (
                  "Geçersiz Miktar"
                ) : (
                  "Likidite Ekle"
                )}
              </Button>
            )}
          </div>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          Likidite ekleyerek protokolün kullanım koşullarını kabul etmiş olursunuz.
        </p>
      </div>
    </div>
  )
}
