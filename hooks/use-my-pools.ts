import { useMemo } from "react"
import { useAccount } from "wagmi"
import { usePools } from "./use-pools"
import { useUserLiquidity } from "./use-user-liquidity"
import { formatUnits } from "viem"

export interface MyPoolPosition {
  poolId: string
  pairAddress: `0x${string}`
  tokenX: {
    symbol: string
    decimals: number
  }
  tokenY: {
    symbol: string
    decimals: number
  }
  binStep: number
  totalLiquidityX: bigint
  totalLiquidityY: bigint
  totalLiquidityXFormatted: string
  totalLiquidityYFormatted: string
  numberOfBins: number
  hasLiquidity: boolean
}

export function useMyPools() {
  const { address } = useAccount()
  const { pools, isLoading: isLoadingPools } = usePools()

  // For each pool, check if user has liquidity
  // We'll fetch liquidity for all pools and filter non-empty ones
  const myPools = useMemo(() => {
    if (!address || !pools || pools.length === 0) return []

    const userPools: MyPoolPosition[] = []

    pools.forEach((pool) => {
      // Note: We can't use useUserLiquidity hook here in a loop
      // Instead, we'll create a separate component that fetches this data
      // For now, we'll just return pool info
      userPools.push({
        poolId: pool.id,
        pairAddress: pool.pairAddress,
        tokenX: {
          symbol: pool.tokenX.symbol,
          decimals: pool.tokenX.decimals,
        },
        tokenY: {
          symbol: pool.tokenY.symbol,
          decimals: pool.tokenY.decimals,
        },
        binStep: pool.binStep,
        totalLiquidityX: BigInt(0),
        totalLiquidityY: BigInt(0),
        totalLiquidityXFormatted: "0",
        totalLiquidityYFormatted: "0",
        numberOfBins: 0,
        hasLiquidity: false,
      })
    })

    return userPools
  }, [pools, address])

  return {
    myPools,
    isLoading: isLoadingPools,
  }
}

// Hook to get a single pool's user liquidity
export function useMyPoolLiquidity(pairAddress: `0x${string}` | undefined) {
  const { positions, isLoading, activeId } = useUserLiquidity(pairAddress)

  const summary = useMemo(() => {
    if (!positions || positions.length === 0) {
      return {
        totalLiquidityX: BigInt(0),
        totalLiquidityY: BigInt(0),
        numberOfBins: 0,
        hasLiquidity: false,
      }
    }

    let totalX = BigInt(0)
    let totalY = BigInt(0)

    positions.forEach((pos) => {
      totalX += pos.amountX
      totalY += pos.amountY
    })

    return {
      totalLiquidityX: totalX,
      totalLiquidityY: totalY,
      numberOfBins: positions.length,
      hasLiquidity: positions.length > 0,
    }
  }, [positions])

  return {
    ...summary,
    positions,
    activeId,
    isLoading,
  }
}
