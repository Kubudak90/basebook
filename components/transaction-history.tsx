"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTransactionHistory, Transaction, TransactionType } from "@/hooks/use-transaction-history"
import { ArrowRight, ArrowUpDown, Plus, Minus, ExternalLink, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useState } from "react"

const getTransactionIcon = (type: TransactionType) => {
  switch (type) {
    case "swap":
      return <ArrowUpDown className="h-4 w-4" />
    case "add_liquidity":
      return <Plus className="h-4 w-4" />
    case "remove_liquidity":
      return <Minus className="h-4 w-4" />
  }
}

const getTransactionLabel = (type: TransactionType) => {
  switch (type) {
    case "swap":
      return "Swap"
    case "add_liquidity":
      return "Add Liquidity"
    case "remove_liquidity":
      return "Remove Liquidity"
  }
}

const getStatusBadge = (status: Transaction["status"]) => {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">Pending</Badge>
    case "success":
      return <Badge variant="default" className="bg-green-600">Success</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
  }
}

export function TransactionHistory() {
  const { transactions, clearHistory } = useTransactionHistory()
  const [filter, setFilter] = useState<TransactionType | "all">("all")

  const filteredTransactions = filter === "all"
    ? transactions
    : transactions.filter(tx => tx.type === filter)

  const openInExplorer = (hash: string) => {
    // Base Sepolia explorer
    window.open(`https://sepolia.basescan.org/tx/${hash}`, "_blank")
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transaction History</CardTitle>
          <div className="flex gap-2">
            {transactions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "swap" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("swap")}
          >
            Swaps
          </Button>
          <Button
            variant={filter === "add_liquidity" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("add_liquidity")}
          >
            Add
          </Button>
          <Button
            variant={filter === "remove_liquidity" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("remove_liquidity")}
          >
            Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">No transactions yet</p>
            <p className="text-sm">Your transaction history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{getTransactionLabel(tx.type)}</span>
                        {getStatusBadge(tx.status)}
                      </div>

                      {tx.type === "swap" && tx.fromToken && tx.toToken && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{tx.fromToken.amount} {tx.fromToken.symbol}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{tx.toToken.amount} {tx.toToken.symbol}</span>
                        </div>
                      )}

                      {(tx.type === "add_liquidity" || tx.type === "remove_liquidity") && tx.poolInfo && (
                        <div className="text-sm text-muted-foreground">
                          {tx.poolInfo.tokenX} / {tx.poolInfo.tokenY} (Bin Step: {tx.poolInfo.binStep})
                        </div>
                      )}

                      {tx.status === "failed" && tx.errorMessage && (
                        <div className="text-xs text-red-500 mt-1">
                          {tx.errorMessage}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openInExplorer(tx.hash)}
                    className="shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
