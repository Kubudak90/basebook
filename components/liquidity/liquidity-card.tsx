"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AddLiquidity } from "./add-liquidity"
import { RemoveLiquidity } from "./remove-liquidity"

export function LiquidityCard() {
  return (
    <Card className="w-full max-w-7xl mx-auto">
      <CardHeader>
        <CardTitle>Liquidity Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="add" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">Add Liquidity</TabsTrigger>
            <TabsTrigger value="remove">Remove Liquidity</TabsTrigger>
          </TabsList>
          <TabsContent value="add" className="mt-6">
            <AddLiquidity />
          </TabsContent>
          <TabsContent value="remove" className="mt-6">
            <RemoveLiquidity />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
