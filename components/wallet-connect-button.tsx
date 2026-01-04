"use client"

import { useState, useEffect } from "react"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { Button } from "./ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { Wallet, LogOut, Copy, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function WalletConnectButton() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { toast } = useToast()

  // Prevent hydration mismatch by only rendering wallet state after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      })
    }
  }

  const openExplorer = () => {
    if (address) {
      window.open(`https://sepolia.basescan.org/address/${address}`, "_blank")
    }
  }

  // Show a consistent loading state during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <Button className="gap-2" disabled>
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    )
  }

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 bg-transparent">
            <Wallet className="h-4 w-4" />
            {formatAddress(address)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={copyAddress}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openExplorer}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View on Explorer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => disconnect()}>
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2">
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {connectors.map((connector) => (
          <DropdownMenuItem key={connector.id} onClick={() => connect({ connector })}>
            {connector.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
