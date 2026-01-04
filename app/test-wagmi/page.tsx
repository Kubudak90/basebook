"use client"

import { useAccount, useConnect, useDisconnect, useReadContract } from "wagmi"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CONTRACTS } from "@/lib/contracts/addresses"
import { LBFactoryABI } from "@/lib/contracts/abis"
import { baseSepolia } from "wagmi/chains"

export default function TestWagmiPage() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  // Test contract read
  const { data: pairInfo, isLoading: isLoadingPair } = useReadContract({
    address: CONTRACTS.LBFactory as `0x${string}`,
    abi: LBFactoryABI,
    functionName: "getPreset",
    args: [25],
    chainId: baseSepolia.id,
  })

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Wagmi Test Sayfası</h1>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Bağlantı Durumu</h2>
        <div className="space-y-2">
          <p>
            <strong>Bağlı mı:</strong> {isConnected ? "✅ Evet" : "❌ Hayır"}
          </p>
          {address && (
            <p>
              <strong>Adres:</strong> <code className="bg-muted px-2 py-1 rounded">{address}</code>
            </p>
          )}
          {chain && (
            <p>
              <strong>Chain:</strong> {chain.name} (ID: {chain.id})
            </p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Mevcut Connector'lar</h2>
        <div className="space-y-2">
          {connectors.map((connector) => (
            <div key={connector.id} className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="font-medium">{connector.name}</p>
                <p className="text-sm text-muted-foreground">ID: {connector.id}</p>
                <p className="text-xs text-muted-foreground">
                  Ready: {connector.ready ? "✅" : "❌"}
                </p>
              </div>
              {!isConnected && (
                <Button
                  onClick={() => connect({ connector })}
                  disabled={isPending || !connector.ready}
                >
                  Bağlan
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {isConnected && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Contract Test</h2>
          <div className="space-y-2">
            <p>
              <strong>Factory Preset (binStep 25):</strong>
            </p>
            {isLoadingPair ? (
              <p>Yükleniyor...</p>
            ) : (
              <pre className="bg-muted p-4 rounded overflow-auto text-xs">
                {JSON.stringify(pairInfo, null, 2)}
              </pre>
            )}
          </div>
        </Card>
      )}

      {isConnected && (
        <Card className="p-6">
          <Button onClick={() => disconnect()} variant="destructive">
            Bağlantıyı Kes
          </Button>
        </Card>
      )}

      <Card className="p-6 bg-muted/50">
        <h2 className="text-xl font-semibold mb-4">Browser Console Test</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Browser console'u açın (F12) ve şu komutları deneyin:
        </p>
        <pre className="bg-background p-4 rounded overflow-auto text-xs">
{`// Wagmi state'ini kontrol et
window.__WAGMI__

// Veya React DevTools ile
// Components tab'ında WagmiProvider'ı bulun`}
        </pre>
      </Card>
    </div>
  )
}

