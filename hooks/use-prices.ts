"use client"

import { useState, useEffect, useCallback } from "react"

// CoinGecko token ID mapping
const COINGECKO_IDS: Record<string, string> = {
    WETH: "ethereum",
    ETH: "ethereum",
    USDC: "usd-coin",
    EURC: "euro-coin",
    USDT: "tether",
    DAI: "dai",
    WBTC: "wrapped-bitcoin",
}

interface PriceData {
    [symbol: string]: {
        usd: number
        lastUpdated: number
    }
}

interface UsePricesResult {
    prices: PriceData
    isLoading: boolean
    error: string | null
    refetch: () => void
    getPrice: (symbol: string) => number | null
    getPairPrice: (symbolA: string, symbolB: string) => number | null
}

// Cache prices for 60 seconds
const CACHE_DURATION = 60 * 1000

let priceCache: PriceData = {}
let lastFetchTime = 0

export function usePrices(symbols: string[] = []): UsePricesResult {
    const [prices, setPrices] = useState<PriceData>(priceCache)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchPrices = useCallback(async () => {
        // Check cache
        const now = Date.now()
        if (now - lastFetchTime < CACHE_DURATION && Object.keys(priceCache).length > 0) {
            setPrices(priceCache)
            return
        }

        // Get CoinGecko IDs for requested symbols
        const ids = symbols
            .map((s) => COINGECKO_IDS[s.toUpperCase()])
            .filter(Boolean)
            .join(",")

        if (!ids) {
            // Fallback: fetch common tokens
            const defaultIds = Object.values(COINGECKO_IDS).join(",")
            try {
                setIsLoading(true)
                setError(null)

                const response = await fetch(
                    `https://api.coingecko.com/api/v3/simple/price?ids=${defaultIds}&vs_currencies=usd`,
                    { next: { revalidate: 60 } }
                )

                if (!response.ok) {
                    throw new Error(`CoinGecko API error: ${response.status}`)
                }

                const data = await response.json()

                // Map back to symbols
                const newPrices: PriceData = {}
                for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
                    if (data[geckoId]) {
                        newPrices[symbol] = {
                            usd: data[geckoId].usd,
                            lastUpdated: now,
                        }
                    }
                }

                priceCache = newPrices
                lastFetchTime = now
                setPrices(newPrices)
            } catch (err: any) {
                setError(err.message)
                // Use fallback prices if API fails
                const fallbackPrices: PriceData = {
                    WETH: { usd: 3500, lastUpdated: now },
                    ETH: { usd: 3500, lastUpdated: now },
                    USDC: { usd: 1, lastUpdated: now },
                    EURC: { usd: 1.05, lastUpdated: now },
                    USDT: { usd: 1, lastUpdated: now },
                    DAI: { usd: 1, lastUpdated: now },
                }
                setPrices(fallbackPrices)
            } finally {
                setIsLoading(false)
            }
            return
        }

        try {
            setIsLoading(true)
            setError(null)

            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
            )

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status}`)
            }

            const data = await response.json()

            // Map back to symbols
            const newPrices: PriceData = { ...priceCache }
            for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
                if (data[geckoId]) {
                    newPrices[symbol] = {
                        usd: data[geckoId].usd,
                        lastUpdated: now,
                    }
                }
            }

            priceCache = newPrices
            lastFetchTime = now
            setPrices(newPrices)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }, [symbols])

    useEffect(() => {
        fetchPrices()
    }, [fetchPrices])

    // Get USD price for a single token
    const getPrice = useCallback(
        (symbol: string): number | null => {
            const upperSymbol = symbol.toUpperCase()
            return prices[upperSymbol]?.usd ?? null
        },
        [prices]
    )

    // Get price of tokenA in terms of tokenB (how many tokenB per 1 tokenA)
    const getPairPrice = useCallback(
        (symbolA: string, symbolB: string): number | null => {
            const priceA = getPrice(symbolA)
            const priceB = getPrice(symbolB)
            if (priceA === null || priceB === null || priceB === 0) return null
            return priceA / priceB
        },
        [getPrice]
    )

    return {
        prices,
        isLoading,
        error,
        refetch: fetchPrices,
        getPrice,
        getPairPrice,
    }
}
