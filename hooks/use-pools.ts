import { useReadContract, useReadContracts, useAccount } from "wagmi"
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses"
import { LBFactoryABI, LBPairABI, ERC20ABI } from "@/lib/contracts/abis"
import { baseSepolia } from "wagmi/chains"
import { useMemo } from "react"

export interface PoolInfo {
    id: string
    pairAddress: `0x${string}`
    tokenX: {
        address: string
        symbol: string
        decimals: number
    }
    tokenY: {
        address: string
        symbol: string
        decimals: number
    }
    binStep: number
    activeId: number
    reserveX: bigint
    reserveY: bigint
    volume24h: number
    liquidity: number
    fees24h: number
    apr24h: number
    hasRewards: boolean
}

// Helper function to sort tokens (tokenX < tokenY)
function sortTokens(tokenA: string, tokenB: string): { tokenX: string; tokenY: string } {
    return tokenA.toLowerCase() < tokenB.toLowerCase()
        ? { tokenX: tokenA, tokenY: tokenB }
        : { tokenX: tokenB, tokenY: tokenA }
}

// Generate all unique token pairs from known tokens
// Computed once at module load time since TOKENS is const
function getAllTokenPairs() {
    const tokens = Object.values(TOKENS)
    const pairs: { tokenX: string; tokenY: string }[] = []

    for (let i = 0; i < tokens.length; i++) {
        for (let j = i + 1; j < tokens.length; j++) {
            const sorted = sortTokens(tokens[i].address, tokens[j].address)
            pairs.push(sorted)
        }
    }

    return pairs
}

// Pre-compute token pairs at module level since TOKENS is const
const TOKEN_PAIRS = getAllTokenPairs()

export function usePools() {
    const { address } = useAccount()

    // Use pre-computed token pairs (no need for useMemo)
    const tokenPairs = TOKEN_PAIRS

    // Build contract calls to get all pairs for each token combination
    const getAllPairsCalls = tokenPairs.map((pair) => ({
        address: CONTRACTS.LBFactory as `0x${string}`,
        abi: LBFactoryABI,
        functionName: "getAllLBPairs",
        args: [pair.tokenX as `0x${string}`, pair.tokenY as `0x${string}`],
        chainId: baseSepolia.id,
    }))

    const { data: allPairsResults, isLoading: isLoadingPairs, error, refetch } = useReadContracts({
        contracts: getAllPairsCalls,
    })

    // Extract all pool addresses and their info
    const poolAddresses = useMemo(() => {
        const pools: Array<{
            pairAddress: `0x${string}`
            tokenX: string
            tokenY: string
            binStep: number
        }> = []

        if (allPairsResults) {
            allPairsResults.forEach((result, index) => {
                if (result?.status === "success" && result.result) {
                    const pairs = result.result as Array<{
                        binStep: bigint
                        lbPair: string
                        createdByOwner: boolean
                        ignoredForRouting: boolean
                    }>

                    const pair = tokenPairs[index]
                    
                    pairs.forEach((pairData) => {
                        const lbPair = pairData.lbPair
                        if (lbPair && lbPair !== "0x0000000000000000000000000000000000000000") {
                            pools.push({
                                pairAddress: lbPair as `0x${string}`,
                                tokenX: pair.tokenX,
                                tokenY: pair.tokenY,
                                binStep: Number(pairData.binStep),
                            })
                        }
                    })
                }
            })
        }

        return pools
    }, [allPairsResults, tokenPairs])

    // Fetch token info for each pool (tokenX and tokenY symbols/decimals)
    const tokenInfoCalls = useMemo(() => {
        const uniqueTokens = new Set<string>()
        poolAddresses.forEach((pool) => {
            uniqueTokens.add(pool.tokenX.toLowerCase())
            uniqueTokens.add(pool.tokenY.toLowerCase())
        })

        return Array.from(uniqueTokens).flatMap((tokenAddr) => [
            {
                address: tokenAddr as `0x${string}`,
                abi: ERC20ABI,
                functionName: "symbol",
                chainId: baseSepolia.id,
            },
            {
                address: tokenAddr as `0x${string}`,
                abi: ERC20ABI,
                functionName: "decimals",
                chainId: baseSepolia.id,
            },
        ])
    }, [poolAddresses])

    const { data: tokenInfoResults } = useReadContracts({
        contracts: tokenInfoCalls,
    })

    // Build token info map
    const tokenInfoMap = useMemo(() => {
        const map = new Map<string, { symbol: string; decimals: number }>()
        
        if (tokenInfoResults) {
            for (let i = 0; i < tokenInfoResults.length; i += 2) {
                const symbolResult = tokenInfoResults[i]
                const decimalsResult = tokenInfoResults[i + 1]
                
                if (symbolResult?.status === "success" && decimalsResult?.status === "success") {
                    const tokenAddr = tokenInfoCalls[i].address.toLowerCase()
                    map.set(tokenAddr, {
                        symbol: symbolResult.result as string,
                        decimals: Number(decimalsResult.result),
                    })
                }
            }
        }

        // Fallback to known tokens
        Object.values(TOKENS).forEach((token) => {
            if (!map.has(token.address.toLowerCase())) {
                map.set(token.address.toLowerCase(), {
                    symbol: token.symbol,
                    decimals: token.decimals,
                })
            }
        })

        return map
    }, [tokenInfoResults, tokenInfoCalls])

    // Process results into PoolInfo array
    const pools: PoolInfo[] = useMemo(() => {
        return poolAddresses.map((pool) => {
            const tokenXInfo = tokenInfoMap.get(pool.tokenX.toLowerCase()) || {
                symbol: "???",
                decimals: 18,
            }
            const tokenYInfo = tokenInfoMap.get(pool.tokenY.toLowerCase()) || {
                symbol: "???",
                decimals: 18,
            }

            return {
                id: `${pool.pairAddress}-${pool.binStep}`,
                pairAddress: pool.pairAddress,
                tokenX: {
                    address: pool.tokenX,
                    symbol: tokenXInfo.symbol,
                    decimals: tokenXInfo.decimals,
                },
                tokenY: {
                    address: pool.tokenY,
                    symbol: tokenYInfo.symbol,
                    decimals: tokenYInfo.decimals,
                },
                binStep: pool.binStep,
                activeId: 0, // Will be fetched per-pool
                reserveX: BigInt(0),
                reserveY: BigInt(0),
                // Real values - in production, fetch from subgraph or indexer
                volume24h: 0,
                liquidity: 0,
                fees24h: 0,
                apr24h: 0,
                hasRewards: false,
            }
        })
    }, [poolAddresses, tokenInfoMap])

    return {
        pools,
        isLoading: isLoadingPairs,
        error,
        refetch,
    }
}

// Hook to get detailed pool info
export function usePoolDetails(pairAddress: `0x${string}` | undefined) {
    const { data, isLoading, error } = useReadContracts({
        contracts: pairAddress
            ? [
                {
                    address: pairAddress,
                    abi: LBPairABI,
                    functionName: "getReservesAndId",
                    chainId: baseSepolia.id,
                },
                {
                    address: pairAddress,
                    abi: LBPairABI,
                    functionName: "getBinStep",
                    chainId: baseSepolia.id,
                },
            ]
            : [],
    })

    const reservesAndId = data?.[0]?.status === "success" ? data[0].result : null
    const binStep = data?.[1]?.status === "success" ? data[1].result : null

    return {
        reserveX: reservesAndId?.[0] as bigint | undefined,
        reserveY: reservesAndId?.[1] as bigint | undefined,
        activeId: reservesAndId?.[2] as number | undefined,
        binStep: binStep as number | undefined,
        isLoading,
        error,
    }
}

// Hook to get bin distribution around active bin
export function useBinDistribution(
    pairAddress: `0x${string}` | undefined,
    activeId: number | undefined,
    numBins: number = 50
) {
    const binIds = activeId
        ? Array.from({ length: numBins }, (_, i) => activeId - Math.floor(numBins / 2) + i)
        : []

    const { data, isLoading, error } = useReadContracts({
        contracts: pairAddress && activeId
            ? binIds.map((binId) => ({
                address: pairAddress,
                abi: LBPairABI,
                functionName: "getBin",
                args: [binId],
                chainId: baseSepolia.id,
            }))
            : [],
    })

    const bins = binIds.map((binId, i) => {
        const result = data?.[i]
        const binData = result?.status === "success" ? result.result as readonly bigint[] : null
        const reserveX = binData?.[0] ?? BigInt(0)
        const reserveY = binData?.[1] ?? BigInt(0)

        return {
            binId,
            reserveX,
            reserveY,
            isActive: binId === activeId,
        }
    })

    return {
        bins,
        isLoading,
        error,
    }
}
