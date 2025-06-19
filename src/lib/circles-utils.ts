import { ethers } from "ethers";

/**
 * Validates if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Validates if a string could be an ENS name
 */
export function isValidENS(name: string): boolean {
  return name.endsWith(".eth") || name.includes(".");
}

/**
 * Normalizes an address to checksum format
 */
export function normalizeAddress(address: string): string {
  try {
    return ethers.getAddress(address);
  } catch {
    return address;
  }
}

/**
 * Truncates an address for display purposes
 */
export function truncateAddress(
  address: string,
  startChars = 6,
  endChars = 4,
): string {
  if (!address) return "";
  if (address.length <= startChars + endChars) return address;

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Formats a CRC balance for display
 */
export function formatCRCBalance(
  balance: number | string,
  decimals = 1,
): string {
  const num = typeof balance === "string" ? parseFloat(balance) : balance;
  if (isNaN(num)) return "0.0";

  return num.toFixed(decimals);
}

/**
 * Calculates if a connection needs a reminder (has >= 24 CRC unclaimed)
 * This threshold represents at least 1 full day of unclaimed CRC
 */
export function needsReminder(unclaimed: number): boolean {
  return unclaimed >= DAILY_CRC_ALLOCATION;
}

/**
 * Gets priority level for reminder based on unclaimed amount
 */
export function getReminderPriority(
  unclaimed: number,
): "low" | "medium" | "high" | "urgent" {
  if (unclaimed >= DAILY_CRC_ALLOCATION * 5) return "urgent"; // 5+ days
  if (unclaimed >= DAILY_CRC_ALLOCATION * 3) return "high"; // 3+ days
  if (unclaimed >= DAILY_CRC_ALLOCATION * 2) return "medium"; // 2+ days
  if (unclaimed >= DAILY_CRC_ALLOCATION) return "low"; // 1+ day
  return "low";
}

/**
 * Gets descriptive text for unclaimed amount
 */
export function getUnclaimedDescription(unclaimed: number): string {
  const days = Math.floor(unclaimed / DAILY_CRC_ALLOCATION);
  const remainingHours = Math.floor(unclaimed % DAILY_CRC_ALLOCATION);

  if (days === 0) {
    return `${remainingHours} hours of unclaimed CRC`;
  } else if (days === 1 && remainingHours === 0) {
    return "1 day of unclaimed CRC";
  } else if (remainingHours === 0) {
    return `${days} days of unclaimed CRC`;
  } else {
    return `${days} days, ${remainingHours} hours of unclaimed CRC`;
  }
}

/**
 * Circles UBI allocation constants (24 CRC per day)
 */
export const DAILY_CRC_ALLOCATION = 24;
export const HOURLY_CRC_ALLOCATION = 1;
export const MAX_UNCLAIMED_DAYS = 7; // Maximum days worth of CRC that can accumulate
export const PERSONAL_MINT_FUNCTION_SIGNATURE = "0x2c6ba5ca"; // personalMint() function signature

/**
 * Calculates unclaimed CRC based on actual last personalMint transaction time
 * This provides accurate calculation based on real blockchain data
 */
export function calculateUnclaimedCRC(
  lastPersonalMintTime?: Date | null,
): number {
  if (!lastPersonalMintTime) {
    throw new Error(
      "Cannot calculate unclaimed CRC: No last personalMint transaction found. User may have never claimed or transaction history is incomplete.",
    );
  }

  const now = new Date();
  const hoursSinceLastClaim =
    (now.getTime() - lastPersonalMintTime.getTime()) / (1000 * 60 * 60);

  // Ensure we don't have negative hours (future dates)
  if (hoursSinceLastClaim < 0) {
    throw new Error(
      "Invalid last claim time: Date is in the future. Check transaction data.",
    );
  }

  // Cap at maximum unclaimed period (e.g., 7 days worth)
  const maxHours = MAX_UNCLAIMED_DAYS * 24;
  const cappedHours = Math.min(hoursSinceLastClaim, maxHours);

  return cappedHours * HOURLY_CRC_ALLOCATION;
}

/**
 * Determines if a transaction is a personalMint transaction
 */
export function isPersonalMintTransaction(transaction: any): boolean {
  if (!transaction) return false;

  return (
    transaction.method === "personalMint" ||
    transaction.input?.startsWith(PERSONAL_MINT_FUNCTION_SIGNATURE) ||
    transaction.event_type === "PersonalMint" ||
    transaction.type === "PersonalMint"
  );
}

/**
 * Calculates hours since last personalMint for display
 */
export function getHoursSinceLastClaim(lastClaimTime?: Date | null): number {
  if (!lastClaimTime) return 0;

  const now = new Date();
  const hours = (now.getTime() - lastClaimTime.getTime()) / (1000 * 60 * 60);
  return Math.max(0, hours);
}

/**
 * @deprecated This function is deprecated and may return inaccurate estimates
 * Use calculateUnclaimedCRC with real transaction data instead
 * @throws Error to prevent usage of deprecated estimation function
 */
export function estimateUnclaimedCRC(lastClaimDate?: Date): number {
  throw new Error(
    "estimateUnclaimedCRC is deprecated. Use calculateUnclaimedCRC with real personalMint transaction data instead.",
  );
}

/**
 * @deprecated This function creates fake data and should not be used
 * @throws Always throws an error to prevent accidental use
 */
export function createMockLastClaimDate(): Date {
  throw new Error(
    "createMockLastClaimDate is deprecated and creates fake data. Use real transaction data instead.",
  );
}

/**
 * Formats time since last claim for display with better granularity
 */
export function formatTimeSinceLastClaim(lastClaimDate?: Date): string {
  if (!lastClaimDate) return "Never claimed or unknown";

  const now = new Date();
  const hoursSince =
    (now.getTime() - lastClaimDate.getTime()) / (1000 * 60 * 60);

  if (hoursSince < 0) return "Invalid date";

  if (hoursSince < 1) {
    const minutesSince = Math.floor(hoursSince * 60);
    return `${minutesSince} minute${minutesSince !== 1 ? "s" : ""} ago`;
  } else if (hoursSince < 24) {
    const hours = Math.floor(hoursSince);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else {
    const daysSince = Math.floor(hoursSince / 24);
    const remainingHours = Math.floor(hoursSince % 24);

    if (remainingHours === 0) {
      return `${daysSince} day${daysSince !== 1 ? "s" : ""} ago`;
    } else {
      return `${daysSince} day${daysSince !== 1 ? "s" : ""}, ${remainingHours} hour${remainingHours !== 1 ? "s" : ""} ago`;
    }
  }
}

/**
 * Formats the last claim time for detailed display
 */
export function formatLastClaimTime(lastClaimDate?: Date): string {
  if (!lastClaimDate) return "No recent claims found";

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };

  return lastClaimDate.toLocaleDateString("en-US", options);
}

/**
 * Generates a reminder message for a connection with better context
 */
export function generateReminderMessage(connection: {
  name?: string;
  address: string;
  unclaimed: number;
  lastClaim?: Date | null;
}): string {
  const name = connection.name || truncateAddress(connection.address);
  const amount = formatCRCBalance(connection.unclaimed);
  const description = getUnclaimedDescription(connection.unclaimed);
  const priority = getReminderPriority(connection.unclaimed);

  // Different message tones based on priority
  let emoji = "🪙";
  let urgencyText = "";

  switch (priority) {
    case "urgent":
      emoji = "🚨";
      urgencyText = " (You're missing out on a lot of CRC!)";
      break;
    case "high":
      emoji = "⏰";
      urgencyText = " (Don't let it accumulate too much!)";
      break;
    case "medium":
      emoji = "💫";
      urgencyText = "";
      break;
    default:
      emoji = "🪙";
      urgencyText = "";
  }

  return `Hey ${name}! 👋 You have ${amount} CRC ready to redeem (${description})${urgencyText} Claim your Circles UBI at https://circles.garden ${emoji} #CirclesUBI #BasicIncome`;
}

/**
 * Creates a URL to view a profile on Circles Garden
 */
export function getCirclesProfileUrl(address: string): string {
  return `https://circles.garden/profile/${address}`;
}

/**
 * Creates a URL to view transactions on Circles Garden
 */
export function getCirclesTransactionsUrl(address: string): string {
  return `https://circles.garden/wallet/${address}`;
}

/**
 * Error messages for common Circles-related errors
 */
export const CIRCLES_ERRORS = {
  NOT_SIGNED_UP: "This address is not signed up to Circles",
  INVALID_ADDRESS: "Please enter a valid Ethereum address or ENS name",
  NETWORK_ERROR: "Unable to connect to Circles network",
  NO_TRUST_RELATIONS: "No trust relations found for this address",
  SDK_NOT_INITIALIZED: "Circles SDK is not initialized",
} as const;

/**
 * Helper to get a user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for specific Circles errors
    if (error.message.includes("not signed up")) {
      return CIRCLES_ERRORS.NOT_SIGNED_UP;
    }
    if (error.message.includes("invalid address")) {
      return CIRCLES_ERRORS.INVALID_ADDRESS;
    }
    return error.message;
  }

  return "An unexpected error occurred";
}

/**
 * Validates and normalizes user input for address/ENS
 */
export function validateAndNormalizeInput(input: string): {
  isValid: boolean;
  normalizedInput: string;
  error?: string;
} {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      isValid: false,
      normalizedInput: "",
      error: "Please enter an address or ENS name",
    };
  }

  // Check if it's a valid Ethereum address
  if (isValidAddress(trimmed)) {
    return {
      isValid: true,
      normalizedInput: normalizeAddress(trimmed),
    };
  }

  // Check if it might be an ENS name
  if (isValidENS(trimmed)) {
    return {
      isValid: true,
      normalizedInput: trimmed.toLowerCase(),
    };
  }

  return {
    isValid: false,
    normalizedInput: trimmed,
    error: CIRCLES_ERRORS.INVALID_ADDRESS,
  };
}
