"use client"

import { useReadContract, useAccount } from "wagmi"
import { ERC20ABI } from "../contracts/abis"

export function useTokenAllowance(tokenAddress: `0x${string}` | undefined, spenderAddress: `0x${string}`) {
  const { address } = useAccount()

  const { data: allowance, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: "allowance",
    args: address && tokenAddress ? [address, spenderAddress] : undefined,
    query: {
      enabled: !!address && !!tokenAddress,
    },
  })

  return {
    allowance: allowance || BigInt(0),
    refetch,
  }
}
