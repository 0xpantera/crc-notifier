"use client";

import { cn } from "~/lib/utils";
import Image from "next/image";
import { useState, useEffect } from "react";

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  [key: string]: unknown;
}
import { createPublicClient, http, parseAbi, getAddress, Chain } from "viem";
import * as chains from "viem/chains";

// Base64 placeholder image
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YxZjFmMSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPk5GVCBJbWFnZTwvdGV4dD48L3N2Zz4=";

// Helper function to process and validate image URLs
function processImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  
  // Handle IPFS URLs
  if (imageUrl.startsWith("ipfs://")) {
    return imageUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  
  // Handle malformed IPFS URLs (like the edge case mentioned)
  if (imageUrl.includes("ipfs.io/ipfs/https://")) {
    // Extract the actual URL after the malformed IPFS prefix
    const actualUrl = imageUrl.split("ipfs.io/ipfs/")[1];
    if (actualUrl && (actualUrl.startsWith("http://") || actualUrl.startsWith("https://"))) {
      return actualUrl;
    }
  }
  
  return imageUrl;
}

// Helper function to retry contract calls with exponential backoff
async function retryContractCall<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as { details?: { code?: number }; message?: string; status?: number };
      const isRateLimit = err?.details?.code === -32016 || 
                         err?.message?.includes("rate limit") ||
                         err?.status === 429;
      
      if (isRateLimit && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`Rate limited, retrying in ${delay}ms...`, err?.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

// Helper function to fetch contract metadata from contractURI
async function fetchContractMetadata(contractAddress: string, client: ReturnType<typeof createPublicClient>): Promise<NFTMetadata | null> {
  try {
    // Try both contractURI variations with retry logic
    let contractURI: string = "";
    
    // Try contractURI (standard) first
    try {
      contractURI = await retryContractCall(async () => 
        await client.readContract({
          address: getAddress(contractAddress),
          abi: erc721Abi,
          functionName: "contractURI",
        }) as string
      );
    } catch (uriError) {
      console.warn("contractURI failed, trying contractUri:", uriError);
      
      // Try contractUri (lowercase) as fallback
      try {
        contractURI = await retryContractCall(async () =>
          await client.readContract({
            address: getAddress(contractAddress),
            abi: erc721Abi,
            functionName: "contractUri",
          }) as string
        );
      } catch (uriLowerError) {
        console.warn("contractUri also failed:", uriLowerError);
      }
    }

    if (!contractURI) {
      console.warn("No contract URI found for contract:", contractAddress);
      return null;
    }

    // Process contractURI to get metadata URL
    let metadataUrl = contractURI;
    if (metadataUrl.startsWith("ipfs://")) {
      metadataUrl = metadataUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
    }

    // Fetch contract metadata
    const response = await fetch(metadataUrl);
    const contractMetadata = await response.json();
    
    return contractMetadata;
  } catch (error) {
    console.warn("Failed to fetch contract metadata:", error);
    return null;
  }
}

// ERC721 ABI for tokenURI, contractURI and name functions
const erc721Abi = parseAbi([
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function contractURI() view returns (string)",
  "function contractUri() view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

// Get all available chains from viem
const availableChains: Record<string, Chain> = {};
Object.entries(chains).forEach(([name, chain]) => {
  if (typeof chain === "object" && chain !== null && "id" in chain) {
    availableChains[name.toLowerCase()] = chain as Chain;
  }
});

type NFTCardProps = {
  contractAddress: string;
  tokenId: string;
  network?: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "full";
  shadow?: boolean;
  objectFit?: "contain" | "cover" | "fill";
  fallbackImageUrl?: string;
  showTitle?: boolean;
  showNetwork?: boolean;
  titlePosition?: "top" | "bottom" | "outside";
  networkPosition?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "outside";
  customTitle?: string;
  customNetworkName?: string;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  imageProps?: React.ComponentProps<typeof Image>;
  titleClassName?: string;
  networkClassName?: string;
  showOwner?: boolean;
  onLoad?: (metadata: NFTMetadata) => void;
  onError?: (error: Error) => void;
  layout?: "compact" | "card" | "detailed";
  containerClassName?: string;
};

export function NFTCard({
  contractAddress,
  tokenId = "1",
  network = "ethereum", // Default to Ethereum mainnet
  alt = "NFT Image",
  className = "",
  width = 300,
  height = 300,
  rounded = "md",
  shadow = true,
  objectFit = "cover",
  fallbackImageUrl = PLACEHOLDER_IMAGE,
  showTitle = true,
  showNetwork = true,
  titlePosition = "outside",
  networkPosition = "top-right",
  customTitle,
  customNetworkName,
  loadingComponent,
  errorComponent,
  imageProps,
  titleClassName = "",
  networkClassName = "",
  showOwner = false,
  onLoad,
  onError,
  layout = "card",
  containerClassName = "",
}: NFTCardProps) {
  const [imageUrl, setImageUrl] = useState<string>(fallbackImageUrl);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(customTitle || null);
  const [networkName, setNetworkName] = useState<string>(
    customNetworkName || "",
  );
  const [owner, setOwner] = useState<string | null>(null);

  const roundedClasses = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  };

  const networkPositionClasses = {
    "top-left": "top-0 left-0 rounded-br-md",
    "top-right": "top-0 right-0 rounded-bl-md",
    "bottom-left": "bottom-0 left-0 rounded-tr-md",
    "bottom-right": "bottom-0 right-0 rounded-tl-md",
    outside: "",
  };

  useEffect(() => {
    if (customTitle) {
      setTitle(customTitle);
    }

    if (customNetworkName) {
      setNetworkName(customNetworkName);
    }
  }, [customTitle, customNetworkName]);

  useEffect(() => {
    const fetchNFTData = async () => {
      if (!contractAddress || !tokenId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Skip chain setup if we have customNetworkName
        if (!customNetworkName) {
          // Normalize network name
          const normalizedNetwork = (network || "ethereum")
            .toLowerCase()
            .replace(/[\s-]/g, "");

          // Find the chain by name
          let selectedChain: Chain | undefined;

          // Try to find exact match first
          if (availableChains[normalizedNetwork]) {
            selectedChain = availableChains[normalizedNetwork];
          } else {
            // Try to find partial match
            const matchingChainName = Object.keys(availableChains).find(
              (chainName) =>
                chainName.includes(normalizedNetwork) ||
                normalizedNetwork.includes(chainName),
            );

            if (matchingChainName) {
              selectedChain = availableChains[matchingChainName];
            }
          }

          // Default to mainnet if no match found
          if (!selectedChain) {
            console.warn(
              `Chain "${network}" not found, defaulting to Ethereum mainnet`,
            );
            selectedChain = chains.mainnet;
            setNetworkName("Ethereum");
          } else {
            setNetworkName(selectedChain.name);
          }

          // Create public client with proper transport (use Alchemy for Base)
          const getTransportForChain = (chain: Chain) => {
            if (chain.id === 8453) { // Base mainnet
              const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
              if (alchemyApiKey) {
                return http(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);
              }
            }
            return http(); // Fallback to default
          };

          const client = createPublicClient({
            chain: selectedChain,
            transport: getTransportForChain(selectedChain),
          });

          console.log(
            `Fetching NFT data from ${selectedChain.name} for contract ${contractAddress} token ${tokenId}`,
          );

          // Skip title setup if we have customTitle
          if (!customTitle) {
            try {
              // Get contract name
              const name = (await client.readContract({
                address: getAddress(contractAddress),
                abi: erc721Abi,
                functionName: "name",
              })) as string;

              // Set title
              setTitle(`${name} #${tokenId}`);
            } catch (nameError) {
              console.warn("Could not fetch NFT name:", nameError);
              setTitle(`NFT #${tokenId}`);
            }
          }

          // Get owner if requested
          if (showOwner) {
            try {
              const ownerAddress = await retryContractCall(async () =>
                await client.readContract({
                  address: getAddress(contractAddress),
                  abi: erc721Abi,
                  functionName: "ownerOf",
                  args: [BigInt(tokenId)],
                }) as string
              );

              setOwner(ownerAddress);
            } catch (ownerError) {
              console.warn("Could not fetch NFT owner:", ownerError);
            }
          }

          let metadata: NFTMetadata | null = null;

          try {
            // Try to get tokenURI first with retry logic
            const tokenURI = await retryContractCall(async () =>
              await client.readContract({
                address: getAddress(contractAddress),
                abi: erc721Abi,
                functionName: "tokenURI",
                args: [BigInt(tokenId)],
              }) as string
            );

            // Process tokenURI to get metadata
            let metadataUrl = tokenURI;

            // Handle IPFS URLs
            if (metadataUrl.startsWith("ipfs://")) {
              metadataUrl = metadataUrl.replace(
                "ipfs://",
                "https://ipfs.io/ipfs/",
              );
            }

            // Fetch metadata
            metadata = await fetch(metadataUrl).then((res) => res.json());
            console.log("NFT metadata from tokenURI:", metadata);
          } catch (tokenError) {
            console.warn("Failed to fetch tokenURI metadata, trying contractURI fallback:", tokenError);
            
            // Fallback to contract metadata
            metadata = await fetchContractMetadata(contractAddress, client);
            if (metadata) {
              console.log("NFT metadata from contractURI:", metadata);
            }
          }

          // If no metadata found, throw error
          if (!metadata) {
            throw new Error("Could not fetch metadata from tokenURI or contractURI");
          }

          // Call onLoad callback if provided
          if (onLoad) {
            onLoad(metadata);
          }

          // Get image URL from metadata and process it
          const nftImageUrl = processImageUrl(metadata.image || "");

          if (nftImageUrl) {
            setImageUrl(nftImageUrl);
          } else {
            // If no image URL found, use placeholder
            setImageUrl(fallbackImageUrl);
          }
        }
      } catch (err) {
        console.error("Error fetching NFT:", err);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(`Failed to load NFT data: ${error.message}`);
        setImageUrl(fallbackImageUrl);

        // Call onError callback if provided
        if (onError) {
          onError(error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFTData();
  }, [
    contractAddress,
    tokenId,
    network,
    fallbackImageUrl,
    customTitle,
    customNetworkName,
    showOwner,
    onLoad,
    onError,
  ]);

  const defaultLoadingComponent = (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-gray-700">
      <div className="w-full h-full bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
    </div>
  );

  const defaultErrorComponent = (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <p className="text-red-500 text-sm text-center px-2">{error}</p>
    </div>
  );

  // Render network badge inside the image
  const renderNetworkBadge = () => {
    if (!showNetwork || !networkName || networkPosition === "outside")
      return null;

    return (
      <div
        className={cn(
          "absolute bg-black/60 px-2 py-1 text-white text-xs",
          networkPositionClasses[networkPosition],
          networkClassName,
        )}
      >
        {networkName}
      </div>
    );
  };

  // Render title inside the image
  const renderInnerTitle = () => {
    if (!showTitle || !title || titlePosition === "outside") return null;

    return (
      <div
        className={cn(
          "absolute left-0 right-0 bg-black/60 p-2 text-white text-sm truncate",
          titlePosition === "top" ? "top-0" : "bottom-0",
          titleClassName,
        )}
      >
        {title}
        {showOwner && owner && (
          <div className="text-xs opacity-70 truncate">
            Owner: {owner.substring(0, 6)}...{owner.substring(owner.length - 4)}
          </div>
        )}
      </div>
    );
  };

  // Render outside information (title, network, owner)
  const renderOutsideInfo = () => {
    if (
      (!showTitle || !title) &&
      (!showNetwork || !networkName || networkPosition !== "outside") &&
      (!showOwner || !owner || titlePosition !== "outside")
    ) {
      return null;
    }

    return (
      <div className="mt-2">
        {showTitle && title && titlePosition === "outside" && (
          <div className={cn("text-sm font-medium truncate", titleClassName)}>
            {title}
          </div>
        )}

        {showNetwork && networkName && networkPosition === "outside" && (
          <div
            className={cn(
              "text-xs text-gray-500 dark:text-gray-400",
              networkClassName,
            )}
          >
            Network: {networkName}
          </div>
        )}

        {showOwner && owner && titlePosition === "outside" && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Owner: {owner.substring(0, 6)}...{owner.substring(owner.length - 4)}
          </div>
        )}
      </div>
    );
  };

  // Apply different layouts
  const getContainerClasses = () => {
    switch (layout) {
      case "compact":
        return "inline-block";
      case "detailed":
        return "flex flex-col overflow-hidden";
      case "card":
      default:
        return "";
    }
  };

  // Create CSS class for width and height
  // Dimension classes will be applied via className

  return (
    <div className={cn(getContainerClasses(), containerClassName)}>
      <div
        className={cn(
          "relative overflow-hidden",
          roundedClasses[rounded],
          shadow && "shadow-md",
          className,
        )}
        style={{ width: `${width}px`, height: `${height}px` }} // Using style prop as a last resort for dynamic dimensions
      >
        {isLoading && (loadingComponent || defaultLoadingComponent)}

        {error && (errorComponent || defaultErrorComponent)}

        <Image
          src={imageUrl}
          alt={alt}
          fill={true}
          className={cn("object-" + objectFit, isLoading && "opacity-0")}
          unoptimized={true}
          onError={() => setImageUrl(PLACEHOLDER_IMAGE)}
          {...imageProps}
        />

        {renderInnerTitle()}
        {renderNetworkBadge()}
      </div>

      {renderOutsideInfo()}
    </div>
  );
}
