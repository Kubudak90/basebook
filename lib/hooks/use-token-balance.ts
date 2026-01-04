"use client"

import { useReadContract, useAccount } from "wagmi"
import { ERC20ABI } from "../contracts/abis"
import { formatUnits } from "viem"

export function useTokenBalance(tokenAddress: `0x${string}` | undefined) {
  const { address } = useAccount()

  const { data: balance, isLoading } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!tokenAddress,
    },
  })

  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: "decimals",
    query: {
      enabled: !!tokenAddress,
    },
  })

  const formattedBalance = balance && decimals ? formatUnits(balance as bigint, decimals as number) : "0"

  return {
    balance,
    formattedBalance,
    decimals,
    isLoading,
  }
}
