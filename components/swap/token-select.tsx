"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { TOKENS } from "@/lib/contracts/addresses"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
}

interface TokenSelectProps {
  selectedToken: Token | null
  onSelectToken: (token: Token) => void
  excludeToken?: Token | null
}

export function TokenSelect({ selectedToken, onSelectToken, excludeToken }: TokenSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const tokenList = Object.values(TOKENS)

  const filteredTokens = tokenList.filter(
    (token) =>
      token.address !== excludeToken?.address &&
      (token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.address.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const handleSelect = (token: Token) => {
    onSelectToken(token)
    setOpen(false)
    setSearchQuery("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          {selectedToken ? (
            <>
              <img
                src={selectedToken.logoURI || "/placeholder.svg"}
                alt={selectedToken.symbol}
                className="h-5 w-5 rounded-full"
              />
              {selectedToken.symbol}
            </>
          ) : (
            "Select Token"
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a token</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search by name or address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => handleSelect(token)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <img src={token.logoURI || "/placeholder.svg"} alt={token.symbol} className="h-8 w-8 rounded-full" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{token.symbol}</div>
                  <div className="text-sm text-muted-foreground">{token.name}</div>
                </div>
              </button>
            ))}
            {filteredTokens.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No tokens found</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
