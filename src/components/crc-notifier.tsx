"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useMiniAppSdk } from "~/hooks/use-miniapp-sdk";
import { toast } from "sonner";
import { Bell, Users, AlertCircle, RefreshCw } from "lucide-react";

// Mock types for now - will be replaced with actual circles-sdk types
interface TrustedConnection {
  address: string;
  name?: string;
  balance: number;
  unclaimed: number;
  lastClaim?: Date;
  isMutualTrust: boolean;
}

interface CirclesData {
  address: string;
  totalBalance: number;
  unclaimed: number;
  trustedConnections: TrustedConnection[];
}

export function CRCNotifier() {
  const { context, sdk, isSDKLoaded } = useMiniAppSdk();
  const [circlesAddress, setCirclesAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [circlesData, setCirclesData] = useState<CirclesData | null>(null);
  const [error, setError] = useState<string>("");

  // Mock function - will be replaced with actual circles-sdk integration
  const fetchCirclesData = useCallback(
    async (address: string): Promise<CirclesData> => {
      // This will be replaced with actual circles-sdk calls
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate API call

      return {
        address,
        totalBalance: 156.7,
        unclaimed: 18.5,
        trustedConnections: [
          {
            address: "0x1234...5678",
            name: "Alice",
            balance: 89.2,
            unclaimed: 25.3,
            lastClaim: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isMutualTrust: true,
          },
          {
            address: "0xabcd...efgh",
            name: "Bob",
            balance: 234.1,
            unclaimed: 31.7,
            lastClaim: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            isMutualTrust: true,
          },
          {
            address: "0x9876...5432",
            balance: 45.8,
            unclaimed: 8.2,
            lastClaim: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            isMutualTrust: false,
          },
        ],
      };
    },
    [],
  );

  const handleAddressSubmit = useCallback(async () => {
    if (!circlesAddress.trim()) {
      setError("Please enter a valid Circles address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data = await fetchCirclesData(circlesAddress.trim());
      setCirclesData(data);
      toast.success("Circles data loaded successfully!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch Circles data";
      setError(errorMessage);
      toast.error("Failed to load Circles data", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [circlesAddress, fetchCirclesData]);

  const sendReminder = useCallback(
    async (connection: TrustedConnection) => {
      if (!context?.user?.fid) {
        toast.error("User not authenticated");
        return;
      }

      try {
        const reminderText = `Hey ${connection.name || connection.address}! 👋 You have ${connection.unclaimed.toFixed(1)} CRC ready to redeem. Don't forget to claim your daily allocation! 🪙`;

        // Use Farcaster's compose cast action
        await sdk.actions.openUrl(
          `https://warpcast.com/~/compose?text=${encodeURIComponent(reminderText)}`,
        );

        toast.success(
          `Reminder sent to ${connection.name || connection.address}!`,
        );
      } catch (err) {
        toast.error("Failed to send reminder");
      }
    },
    [context, sdk],
  );

  const refreshData = useCallback(async () => {
    if (circlesData?.address) {
      setIsLoading(true);
      try {
        const data = await fetchCirclesData(circlesData.address);
        setCirclesData(data);
        toast.success("Data refreshed!");
      } catch (err) {
        toast.error("Failed to refresh data");
      } finally {
        setIsLoading(false);
      }
    }
  }, [circlesData?.address, fetchCirclesData]);

  const connectionsNeedingReminder =
    circlesData?.trustedConnections.filter((conn) => conn.unclaimed >= 24) ||
    [];

  if (!isSDKLoaded) {
    return <div className="text-center p-4">Loading...</div>;
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Bell className="h-5 w-5" />
            CRC Notifier
          </CardTitle>
          <CardDescription>
            Check your trusted connections' CRC allocations and remind them to
            redeem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="circles-address">Circles Address</Label>
            <div className="flex gap-2">
              <Input
                id="circles-address"
                placeholder="0x... or ENS name"
                value={circlesAddress}
                onChange={(e) => setCirclesAddress(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddressSubmit()}
              />
              <Button
                onClick={handleAddressSubmit}
                disabled={isLoading}
                size="sm"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  "Check"
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {circlesData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Balance</CardTitle>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-2xl font-bold">
                    {circlesData.totalBalance.toFixed(1)} CRC
                  </p>
                  <p className="text-sm text-gray-500">Total Balance</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-green-600">
                    {circlesData.unclaimed.toFixed(1)} CRC
                  </p>
                  <p className="text-sm text-gray-500">Unclaimed</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Trusted Connections
                </CardTitle>
                <Button onClick={refreshData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                {connectionsNeedingReminder.length} connections have 24+ CRC to
                redeem
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full">
                <div className="space-y-3">
                  {circlesData.trustedConnections.map((connection, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {connection.name ||
                              `${connection.address.slice(0, 6)}...${connection.address.slice(-4)}`}
                          </p>
                          {connection.isMutualTrust && (
                            <Badge variant="secondary" className="text-xs">
                              Mutual
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-gray-500">
                          <span>{connection.balance.toFixed(1)} CRC</span>
                          <span
                            className={
                              connection.unclaimed >= 24
                                ? "text-orange-600 font-medium"
                                : ""
                            }
                          >
                            {connection.unclaimed.toFixed(1)} unclaimed
                          </span>
                        </div>
                        {connection.lastClaim && (
                          <p className="text-xs text-gray-400">
                            Last claim:{" "}
                            {Math.floor(
                              (Date.now() - connection.lastClaim.getTime()) /
                                (24 * 60 * 60 * 1000),
                            )}{" "}
                            days ago
                          </p>
                        )}
                      </div>
                      {connection.unclaimed >= 24 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendReminder(connection)}
                          className="ml-2"
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {connectionsNeedingReminder.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-3">
                      {connectionsNeedingReminder.length} friend
                      {connectionsNeedingReminder.length !== 1 ? "s" : ""} need
                      {connectionsNeedingReminder.length === 1 ? "s" : ""} a
                      reminder
                    </p>
                    <Button
                      onClick={() => {
                        connectionsNeedingReminder.forEach((conn) =>
                          sendReminder(conn),
                        );
                      }}
                      className="w-full"
                    >
                      Send All Reminders
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
