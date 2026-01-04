import { useReadContracts, useAccount } from "wagmi"
import { LBPairABI } from "@/lib/contracts/abis"
import { baseSepolia } from "wagmi/chains"

export interface UserPosition {
    binId: number
    balance: bigint
    reserveX: bigint
    reserveY: bigint
}

export function useUserPositions(
    pairAddress: `0x${string}` | undefined,
    activeId: number | undefined,
    range: number = 50
) {
    const { address } = useAccount()

    const binIds = activeId
        ? Array.from({ length: range }, (_, i) => activeId - Math.floor(range / 2) + i)
        : []

    // Get user balances for each bin
    const { data: balanceData, isLoading: balanceLoading } = useReadContracts({
        contracts: pairAddress && address && activeId
            ? binIds.map((binId) => ({
                address: pairAddress,
                abi: LBPairABI,
                functionName: "balanceOf" as const,
                args: [address, BigInt(binId)] as const,
                chainId: baseSepolia.id,
            }))
            : [],
    })

    // Get bin reserves
    const { data: binData, isLoading: binLoading } = useReadContracts({
        contracts: pairAddress && activeId
            ? binIds.map((binId) => ({
                address: pairAddress,
                abi: LBPairABI,
                functionName: "getBin" as const,
                args: [binId] as const,
                chainId: baseSepolia.id,
            }))
            : [],
    })

    const positions: UserPosition[] = binIds
        .map((binId, i) => {
            const balanceResult = balanceData?.[i]
            const balance = balanceResult?.status === "success" && balanceResult.result
                ? BigInt(String(balanceResult.result))
                : BigInt(0)

            const binResult = binData?.[i]
            let reserveX = BigInt(0)
            let reserveY = BigInt(0)

            if (binResult?.status === "success" && Array.isArray(binResult.result)) {
                const [rx, ry] = binResult.result as readonly [bigint, bigint]
                reserveX = rx
                reserveY = ry
            }

            return {
                binId,
                balance,
                reserveX,
                reserveY,
            }
        })
        .filter((p) => p.balance > BigInt(0)) // Only return bins with user balance

    const totalValueX = positions.reduce((sum, p) => sum + p.reserveX, BigInt(0))
    const totalValueY = positions.reduce((sum, p) => sum + p.reserveY, BigInt(0))

    return {
        positions,
        totalValueX,
        totalValueY,
        binCount: positions.length,
        isLoading: balanceLoading || binLoading,
    }
}

// Hook to get all bin data for visualization
export function useBinData(
    pairAddress: `0x${string}` | undefined,
    activeId: number | undefined,
    range: number = 50
) {
    const { address } = useAccount()

    const binIds = activeId
        ? Array.from({ length: range }, (_, i) => activeId - Math.floor(range / 2) + i)
        : []

    // Get bin reserves
    const { data: binData, isLoading: binLoading, refetch } = useReadContracts({
        contracts: pairAddress && activeId
            ? binIds.map((binId) => ({
                address: pairAddress,
                abi: LBPairABI,
                functionName: "getBin" as const,
                args: [binId] as const,
                chainId: baseSepolia.id,
            }))
            : [],
    })

    // Get user balances
    const { data: balanceData, isLoading: balanceLoading } = useReadContracts({
        contracts: pairAddress && address && activeId
            ? binIds.map((binId) => ({
                address: pairAddress,
                abi: LBPairABI,
                functionName: "balanceOf" as const,
                args: [address, BigInt(binId)] as const,
                chainId: baseSepolia.id,
            }))
            : [],
    })

    const bins = binIds.map((binId, i) => {
        const binResult = binData?.[i]
        let reserveX = 0
        let reserveY = 0

        if (binResult?.status === "success" && Array.isArray(binResult.result)) {
            const [rx, ry] = binResult.result as readonly [bigint, bigint]
            reserveX = Number(rx)
            reserveY = Number(ry)
        }

        const balanceResult = balanceData?.[i]
        const userBalance = balanceResult?.status === "success" && balanceResult.result
            ? Number(String(balanceResult.result))
            : 0

        return {
            binId,
            index: i,
            reserveX,
            reserveY,
            userBalance,
            hasLiquidity: reserveX > 0 || reserveY > 0,
            hasUserPosition: userBalance > 0,
            isActive: binId === activeId,
        }
    })

    return {
        bins,
        isLoading: binLoading || balanceLoading,
        refetch,
    }
}
