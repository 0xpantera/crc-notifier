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
import {
  useCircles,
  type TrustedConnection,
  type CirclesUserData,
} from "~/hooks/use-circles";
import { toast } from "sonner";
import {
  Bell,
  Users,
  AlertCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  validateAndNormalizeInput,
  formatCRCBalance,
  truncateAddress,
  generateReminderMessage,
  getCirclesProfileUrl,
  getErrorMessage,
  needsReminder,
  formatTimeSinceLastClaim,
  getUnclaimedDescription,
  getReminderPriority,
  DAILY_CRC_ALLOCATION,
} from "~/lib/circles-utils";

export function CRCNotifier() {
  const { context, sdk, isSDKLoaded } = useMiniAppSdk();
  const {
    isInitialized,
    fetchUserData,
    isLoading: circlesLoading,
    error: circlesError,
  } = useCircles();
  const [circlesAddress, setCirclesAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [circlesData, setCirclesData] = useState<CirclesUserData | null>(null);
  const [error, setError] = useState<string>("");

  // Update error state when circles hook has an error
  useEffect(() => {
    if (circlesError) {
      setError(circlesError);
    }
  }, [circlesError]);

  const handleAddressSubmit = useCallback(async () => {
    // Validate input
    const validation = validateAndNormalizeInput(circlesAddress);
    if (!validation.isValid) {
      setError(validation.error || "Please enter a valid address");
      return;
    }

    if (!isInitialized) {
      setError("Circles SDK not initialized");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data = await fetchUserData(validation.normalizedInput);
      setCirclesData(data);
      toast.success("Circles data loaded successfully!");
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      toast.error("Failed to load Circles data", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [circlesAddress, fetchUserData, isInitialized]);

  const sendReminder = useCallback(
    async (connection: TrustedConnection) => {
      if (!context?.user?.fid) {
        toast.error("User not authenticated");
        return;
      }

      try {
        const reminderText = generateReminderMessage(connection);

        // Use Farcaster's compose cast action
        await sdk.actions.openUrl(
          `https://warpcast.com/~/compose?text=${encodeURIComponent(reminderText)}`,
        );

        toast.success(
          `Reminder sent to ${connection.name || truncateAddress(connection.address)}!`,
        );
      } catch (err) {
        toast.error("Failed to send reminder");
      }
    },
    [context, sdk],
  );

  const refreshData = useCallback(async () => {
    if (circlesData?.address && isInitialized) {
      setIsLoading(true);
      try {
        const data = await fetchUserData(circlesData.address);
        setCirclesData(data);
        toast.success("Data refreshed!");
      } catch (err) {
        toast.error("Failed to refresh data");
      } finally {
        setIsLoading(false);
      }
    }
  }, [circlesData?.address, fetchUserData, isInitialized]);

  const connectionsNeedingReminder =
    circlesData?.trustedConnections.filter((conn) =>
      needsReminder(conn.unclaimed),
    ) || [];

  if (!isSDKLoaded || !isInitialized) {
    return (
      <div className="w-full max-w-md mx-auto p-4">
        <Card>
          <CardContent className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading Circles SDK...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const actualLoading = isLoading || circlesLoading;

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
                disabled={actualLoading}
                size="sm"
              >
                {actualLoading ? (
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
                    {formatCRCBalance(circlesData.totalBalance)} CRC
                  </p>
                  <p className="text-sm text-gray-500">Total Balance</p>
                </div>
                <div className="text-right">
                  {circlesData.unclaimed > 0 ? (
                    <>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCRCBalance(circlesData.unclaimed)} CRC
                      </p>
                      <p className="text-sm text-gray-500">Unclaimed</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-yellow-600">
                        ⚠️ Unknown
                      </p>
                      <p className="text-xs text-gray-500">
                        Cannot calculate - no transaction data
                      </p>
                    </>
                  )}
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
                <Button
                  onClick={refreshData}
                  variant="outline"
                  size="sm"
                  disabled={actualLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${actualLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
              <CardDescription>
                {connectionsNeedingReminder.length > 0 ? (
                  <>
                    {connectionsNeedingReminder.length} connections have{" "}
                    {DAILY_CRC_ALLOCATION}+ CRC to redeem
                  </>
                ) : (
                  <>
                    No connections need reminders (or unable to calculate
                    unclaimed amounts)
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {circlesData.trustedConnections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trusted connections found</p>
                  <p className="text-sm">This could mean:</p>
                  <ul className="text-xs text-left mt-2 space-y-1">
                    <li>• No trust relationships established yet</li>
                    <li>• Trust transactions not indexed</li>
                    <li>• Network connectivity issues</li>
                  </ul>
                  <p className="text-sm mt-4">
                    Start building your trust network on{" "}
                    <button
                      className="text-blue-500 underline"
                      onClick={() =>
                        sdk.actions.openUrl("https://circles.garden")
                      }
                    >
                      Circles Garden
                    </button>
                    !
                  </p>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-64 w-full">
                    <div className="space-y-3">
                      {circlesData.trustedConnections.map(
                        (connection, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {connection.name ||
                                    truncateAddress(connection.address)}
                                </p>
                                {connection.isMutualTrust && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Mutual
                                  </Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() =>
                                    sdk.actions.openUrl(
                                      getCirclesProfileUrl(connection.address),
                                    )
                                  }
                                  title="View profile"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex gap-4 text-sm text-gray-500">
                                <span>
                                  {formatCRCBalance(connection.balance)} CRC
                                </span>
                                <span
                                  className={
                                    needsReminder(connection.unclaimed)
                                      ? "text-orange-600 font-medium"
                                      : ""
                                  }
                                >
                                  {formatCRCBalance(connection.unclaimed)}{" "}
                                  unclaimed
                                </span>
                              </div>
                              <div className="text-xs text-gray-400">
                                {connection.unclaimed > 0 ? (
                                  <>
                                    {getUnclaimedDescription(
                                      connection.unclaimed,
                                    )}
                                    {getReminderPriority(
                                      connection.unclaimed,
                                    ) === "urgent" && (
                                      <span className="text-red-500 font-medium">
                                        {" "}
                                        • Urgent!
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-yellow-600">
                                    ⚠️ Cannot calculate unclaimed amount - no
                                    transaction data
                                  </span>
                                )}
                              </div>
                              {connection.lastClaim ? (
                                <p className="text-xs text-gray-400">
                                  Last claim:{" "}
                                  {formatTimeSinceLastClaim(
                                    connection.lastClaim,
                                  )}
                                </p>
                              ) : (
                                <p className="text-xs text-yellow-600">
                                  ⚠️ No personalMint transactions found
                                </p>
                              )}
                            </div>
                            {connection.unclaimed > 0 &&
                              needsReminder(connection.unclaimed) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => sendReminder(connection)}
                                  className="ml-2"
                                  title="Send reminder"
                                >
                                  <Bell className="h-4 w-4" />
                                </Button>
                              )}
                          </div>
                        ),
                      )}
                    </div>
                  </ScrollArea>

                  {connectionsNeedingReminder.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-3">
                          {connectionsNeedingReminder.length} friend
                          {connectionsNeedingReminder.length !== 1
                            ? "s"
                            : ""}{" "}
                          {connectionsNeedingReminder.length === 1
                            ? "has"
                            : "have"}{" "}
                          {DAILY_CRC_ALLOCATION}+ CRC to claim
                        </p>
                        <Button
                          onClick={() => {
                            connectionsNeedingReminder.forEach((conn) =>
                              sendReminder(conn),
                            );
                          }}
                          className="w-full"
                        >
                          Send All Reminders (
                          {connectionsNeedingReminder.length})
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
