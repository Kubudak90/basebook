"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { usePools } from "@/hooks/use-pools"
import { useMyPoolLiquidity } from "@/hooks/use-my-pools"
import { formatUnits } from "viem"
import { ChevronRight, TrendingUp } from "lucide-react"
import { useState } from "react"

interface PoolCardProps {
  poolId: string
  pairAddress: `0x${string}`
  tokenX: { symbol: string; decimals: number }
  tokenY: { symbol: string; decimals: number }
  binStep: number
  onManage?: () => void
}

function PoolCard({ pairAddress, tokenX, tokenY, binStep, onManage }: PoolCardProps) {
  const { totalLiquidityX, totalLiquidityY, numberOfBins, hasLiquidity, isLoading } =
    useMyPoolLiquidity(pairAddress)

  // Don't render if no liquidity
  if (!isLoading && !hasLiquidity) {
    return null
  }

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Token icons */}
            <div className="flex items-center -space-x-2">
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold text-white border-2 border-background z-10">
                {tokenX.symbol.slice(0, 2)}
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-sm font-bold text-white border-2 border-background">
                {tokenY.symbol.slice(0, 2)}
              </div>
            </div>

            {/* Pool info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">
                  {tokenX.symbol} / {tokenY.symbol}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {binStep} bps
                </Badge>
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-3 w-3" />
                  <span>Loading...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{tokenX.symbol}: </span>
                      <span className="font-mono font-medium">
                        {formatUnits(totalLiquidityX, tokenX.decimals).slice(0, 10)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{tokenY.symbol}: </span>
                      <span className="font-mono font-medium">
                        {formatUnits(totalLiquidityY, tokenY.decimals).slice(0, 10)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {numberOfBins} {numberOfBins === 1 ? "bin" : "bins"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onManage}
            disabled={isLoading}
            className="shrink-0"
          >
            Manage
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface MyPoolsProps {
  onManagePool?: (poolId: string) => void
}

export function MyPools({ onManagePool }: MyPoolsProps = {}) {
  const { pools, isLoading, error } = usePools()
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null)

  const handleManagePool = (poolId: string) => {
    setSelectedPoolId(poolId)
    if (onManagePool) {
      onManagePool(poolId)
    } else {
      console.log("Managing pool:", poolId)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center gap-2">
            <Spinner />
            <span className="text-muted-foreground">Loading your pools...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-red-500 mb-2">Failed to load pools</p>
          <p className="text-sm text-muted-foreground">Please try again later</p>
        </CardContent>
      </Card>
    )
  }

  if (!pools || pools.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">No pools available</p>
          <p className="text-sm text-muted-foreground">
            There are no liquidity pools on this network yet
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>My Liquidity Pools</CardTitle>
            <Badge variant="outline">
              {pools.length} {pools.length === 1 ? "pool" : "pools"} available
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Pools where you have active liquidity positions
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {pools.map((pool) => (
          <PoolCard
            key={pool.id}
            poolId={pool.id}
            pairAddress={pool.pairAddress}
            tokenX={{
              symbol: pool.tokenX.symbol,
              decimals: pool.tokenX.decimals,
            }}
            tokenY={{
              symbol: pool.tokenY.symbol,
              decimals: pool.tokenY.decimals,
            }}
            binStep={pool.binStep}
            onManage={() => handleManagePool(pool.id)}
          />
        ))}
      </div>

      {/* Show message if all pools are empty */}
      <Card className="mt-4 border-dashed">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don't see your positions? Make sure you're connected to the correct wallet
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
