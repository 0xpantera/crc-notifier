"use client";

import { useState, useCallback, useEffect } from "react";
import { CirclesData, CirclesRpc } from "@circles-sdk/data";
import { Sdk } from "@circles-sdk/sdk";
import { BrowserProviderContractRunner } from "@circles-sdk/adapter-ethers";
import { circlesConfig } from "~/lib/circles-config";
import { ethers } from "ethers";

// Constants for CRC calculation
const CRC_PER_HOUR = 1;
const CRC_PER_DAY = 24;
const PERSONAL_MINT_FUNCTION_SIGNATURE = "0x2c6ba5ca"; // personalMint() function signature

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface TrustedConnection {
  address: string;
  name?: string;
  balance: number;
  unclaimed: number;
  lastClaim?: Date;
  isMutualTrust: boolean;
  avatarInfo?: any;
}

export interface CirclesUserData {
  address: string;
  totalBalance: number;
  unclaimed: number;
  trustedConnections: TrustedConnection[];
  isSignedUp: boolean;
  avatarInfo?: any;
}

export function useCircles() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sdk, setSdk] = useState<Sdk | null>(null);
  const [data, setData] = useState<CirclesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Function to get the last personalMint transaction timestamp
  const getLastPersonalMintTime = useCallback(
    async (address: string): Promise<Date | null> => {
      if (!data) return null;

      try {
        // Get transaction history for the address
        const transactionQuery = data.getTransactionHistory(
          address as `0x${string}`,
          100,
        );
        const transactions = await transactionQuery.queryNextPage();

        if (!transactions || !Array.isArray(transactions)) {
          return null;
        }

        // Filter for personalMint transactions (method signature or event analysis)
        // Look for transactions that are PersonalMint events or personalMint calls
        const personalMintTransactions = transactions.filter((tx: any) => {
          // Check if it's a PersonalMint event or contains personalMint call
          return (
            tx.transaction?.method === "personalMint" ||
            tx.transaction?.input?.startsWith(
              PERSONAL_MINT_FUNCTION_SIGNATURE,
            ) ||
            tx.event_type === "PersonalMint"
          );
        });

        if (personalMintTransactions.length === 0) {
          // No personalMint found - we cannot determine when they last claimed
          console.warn(`No personalMint transactions found for ${address}`);
          return null;
        }

        // Get the most recent personalMint transaction
        const lastMint = personalMintTransactions[0]; // Assuming sorted by most recent first

        if (lastMint.timestamp) {
          return new Date(lastMint.timestamp * 1000); // Convert Unix timestamp to Date
        }

        return null;
      } catch (err) {
        console.warn(
          `Could not fetch transaction history for ${address}:`,
          err,
        );
        return null;
      }
    },
    [data],
  );

  // Function to calculate unclaimed CRC based on last claim time
  const calculateUnclaimedCRC = useCallback(
    (lastClaimTime: Date | null): number => {
      if (!lastClaimTime) {
        // If we can't determine last claim, we cannot calculate unclaimed amount
        throw new Error(
          "Cannot calculate unclaimed CRC: No last claim time available",
        );
      }

      const now = new Date();
      const hoursSinceLastClaim =
        (now.getTime() - lastClaimTime.getTime()) / (1000 * 60 * 60);

      // Cap at reasonable maximum (e.g., 7 days worth = 168 hours)
      const maxHours = 7 * 24;
      const cappedHours = Math.min(Math.max(0, hoursSinceLastClaim), maxHours);

      return cappedHours * CRC_PER_HOUR;
    },
    [],
  );

  // Initialize the Circles SDK
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        // Initialize CirclesData for read-only operations
        const circlesRpc = new CirclesRpc(circlesConfig.circlesRpcUrl);
        const circlesData = new CirclesData(circlesRpc);
        setData(circlesData);
        setIsInitialized(true);

        // Initialize full SDK for write operations (if needed)
        if (typeof window !== "undefined" && window.ethereum) {
          try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contractRunner = new BrowserProviderContractRunner();
            const fullSdk = new Sdk(contractRunner, circlesConfig);
            setSdk(fullSdk);
          } catch (err) {
            console.warn("Could not initialize full SDK:", err);
            // Continue with read-only operations
          }
        }
      } catch (err) {
        console.error("Failed to initialize Circles SDK:", err);
        setError("Failed to initialize Circles SDK");
      }
    };

    initializeSDK();
  }, []);

  const fetchUserData = useCallback(
    async (address: string): Promise<CirclesUserData> => {
      if (!data) {
        throw new Error("Circles SDK not initialized");
      }

      setIsLoading(true);
      setError("");

      try {
        // Check if avatar exists
        const avatarInfo = await data.getAvatarInfo(address as `0x${string}`);
        if (!avatarInfo) {
          throw new Error("Address is not signed up to Circles");
        }

        // Get total balance with better error handling
        let totalBalance = 0;
        try {
          const [balanceV1Result, balanceV2Result] = await Promise.allSettled([
            data.getTotalBalance(address as `0x${string}`),
            data.getTotalBalanceV2(address as `0x${string}`),
          ]);

          const v1Balance =
            balanceV1Result.status === "fulfilled"
              ? parseFloat(balanceV1Result.value || "0")
              : 0;
          const v2Balance =
            balanceV2Result.status === "fulfilled"
              ? parseFloat(balanceV2Result.value || "0")
              : 0;

          totalBalance = v1Balance + v2Balance;

          if (totalBalance === 0) {
            console.warn("No balance found - user might be new to Circles");
          }
        } catch (err) {
          console.warn("Could not fetch balances:", err);
          // Don't throw here, just log the warning and continue with 0 balance
        }

        // Get trust relations
        const trustRelationsQuery = data.getTrustRelations(
          address as `0x${string}`,
          100,
        );
        const trustRelations = await trustRelationsQuery.queryNextPage();

        // Process trust relations to get connections
        const trustedConnections: TrustedConnection[] = [];

        if (trustRelations && Array.isArray(trustRelations)) {
          for (const relation of trustRelations) {
            // Determine the other party in the relation
            const otherAddress =
              relation.truster === address
                ? relation.trustee
                : relation.truster;

            // Skip self-references
            if (otherAddress === address) continue;

            // Check if this is a mutual trust relationship
            const isMutualTrust = trustRelations.some(
              (r: any) =>
                (r.truster === otherAddress && r.trustee === address) ||
                (r.truster === address && r.trustee === otherAddress),
            );

            // Get avatar info for the connection
            let connectionAvatarInfo;
            try {
              connectionAvatarInfo = await data.getAvatarInfo(
                otherAddress as `0x${string}`,
              );
            } catch (err) {
              console.warn(
                `Could not fetch avatar info for ${otherAddress}:`,
                err,
              );
            }

            // Get balance for the connection with retry logic
            let connectionBalance = 0;
            try {
              const [balanceV1, balanceV2] = await Promise.allSettled([
                data.getTotalBalance(otherAddress as `0x${string}`),
                data.getTotalBalanceV2(otherAddress as `0x${string}`),
              ]);

              const v1Amount =
                balanceV1.status === "fulfilled"
                  ? parseFloat(balanceV1.value || "0")
                  : 0;
              const v2Amount =
                balanceV2.status === "fulfilled"
                  ? parseFloat(balanceV2.value || "0")
                  : 0;
              connectionBalance = v1Amount + v2Amount;
            } catch (err) {
              console.warn(`Could not fetch balance for ${otherAddress}:`, err);
              // Cannot determine balance - set to 0 and surface the error
              connectionBalance = 0;
            }

            // Get real last personalMint time for this connection
            const lastClaimTime = await getLastPersonalMintTime(otherAddress);

            // Calculate actual unclaimed amount based on real last claim time
            let unclaimedAmount = 0;
            try {
              unclaimedAmount = calculateUnclaimedCRC(lastClaimTime);
            } catch (err) {
              console.warn(
                `Could not calculate unclaimed CRC for ${otherAddress}:`,
                err,
              );
              // Skip this connection if we can't calculate unclaimed amount properly
              continue;
            }

            trustedConnections.push({
              address: otherAddress,
              name: (connectionAvatarInfo as any)?.displayName || undefined,
              balance: connectionBalance,
              unclaimed: unclaimedAmount,
              lastClaim: lastClaimTime,
              isMutualTrust,
              avatarInfo: connectionAvatarInfo,
            });
          }
        }

        // Remove duplicates based on address
        const uniqueConnections = trustedConnections.filter(
          (conn, index, self) =>
            index === self.findIndex((c) => c.address === conn.address),
        );

        // Calculate user's own unclaimed amount based on real last claim time
        const userLastClaimTime = await getLastPersonalMintTime(address);
        let userUnclaimed = 0;
        try {
          userUnclaimed = calculateUnclaimedCRC(userLastClaimTime);
        } catch (err) {
          console.warn(
            `Could not calculate user's unclaimed CRC for ${address}:`,
            err,
          );
          // Set to 0 if we can't calculate - this will be visible to user
          userUnclaimed = 0;
        }

        return {
          address,
          totalBalance,
          unclaimed: Math.max(0, userUnclaimed),
          trustedConnections: uniqueConnections,
          isSignedUp: true,
          avatarInfo,
        };
      } catch (err) {
        console.error("Error fetching user data:", err);
        let errorMessage = "Failed to fetch user data";

        if (err instanceof Error) {
          if (
            err.message.includes("not signed up") ||
            err.message.includes("Avatar not found")
          ) {
            errorMessage = "This address is not registered with Circles";
          } else if (
            err.message.includes("network") ||
            err.message.includes("fetch")
          ) {
            errorMessage = "Network error - please check your connection";
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [data],
  );

  const getAvatarProfile = useCallback(
    async (address: string) => {
      if (!data) return null;

      try {
        const avatarInfo = await data.getAvatarInfo(address as `0x${string}`);
        return avatarInfo;
      } catch (err) {
        console.warn(`Could not fetch profile for ${address}:`, err);
        return null;
      }
    },
    [data],
  );

  const getTrustRelations = useCallback(
    async (address: string) => {
      if (!data) return [];

      try {
        const trustRelationsQuery = data.getTrustRelations(
          address as `0x${string}`,
          100,
        );
        const trustRelations = await trustRelationsQuery.queryNextPage();
        return Array.isArray(trustRelations) ? trustRelations : [];
      } catch (err) {
        console.warn(`Could not fetch trust relations for ${address}:`, err);
        return [];
      }
    },
    [data],
  );

  return {
    isInitialized,
    sdk,
    data,
    isLoading,
    error,
    fetchUserData,
    getAvatarProfile,
    getTrustRelations,
  };
}
