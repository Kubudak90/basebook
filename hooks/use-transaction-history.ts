import { useState, useEffect, useCallback } from "react"

export type TransactionType = "swap" | "add_liquidity" | "remove_liquidity"
export type TransactionStatus = "pending" | "success" | "failed"

export interface Transaction {
  id: string
  type: TransactionType
  status: TransactionStatus
  hash: `0x${string}`
  timestamp: number
  fromToken?: {
    symbol: string
    amount: string
  }
  toToken?: {
    symbol: string
    amount: string
  }
  poolInfo?: {
    tokenX: string
    tokenY: string
    binStep: number
  }
  errorMessage?: string
}

const STORAGE_KEY = "basebook_transaction_history"
const MAX_TRANSACTIONS = 50 // Keep last 50 transactions

export function useTransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Load transactions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Transaction[]
        setTransactions(parsed)
      }
    } catch (error) {
      console.error("Failed to load transaction history:", error)
    }
  }, [])

  // Save transactions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
    } catch (error) {
      console.error("Failed to save transaction history:", error)
    }
  }, [transactions])

  // Add a new transaction
  const addTransaction = useCallback((tx: Omit<Transaction, "id" | "timestamp">) => {
    const newTx: Transaction = {
      ...tx,
      id: `${tx.hash}-${Date.now()}`,
      timestamp: Date.now(),
    }

    setTransactions((prev) => {
      const updated = [newTx, ...prev]
      // Keep only the last MAX_TRANSACTIONS
      return updated.slice(0, MAX_TRANSACTIONS)
    })

    return newTx.id
  }, [])

  // Update transaction status
  const updateTransaction = useCallback((hash: `0x${string}`, updates: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.hash === hash ? { ...tx, ...updates } : tx))
    )
  }, [])

  // Clear all transactions
  const clearHistory = useCallback(() => {
    setTransactions([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Get transactions by type
  const getTransactionsByType = useCallback(
    (type: TransactionType) => {
      return transactions.filter((tx) => tx.type === type)
    },
    [transactions]
  )

  // Get pending transactions
  const getPendingTransactions = useCallback(() => {
    return transactions.filter((tx) => tx.status === "pending")
  }, [transactions])

  return {
    transactions,
    addTransaction,
    updateTransaction,
    clearHistory,
    getTransactionsByType,
    getPendingTransactions,
  }
}
