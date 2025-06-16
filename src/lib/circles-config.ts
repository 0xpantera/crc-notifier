import type { CirclesConfig } from "@circles-sdk/sdk";

// Gnosis Chain configuration for production
export const gnosisChainConfig: CirclesConfig = {
  circlesRpcUrl: "https://rpc.aboutcircles.com/",
  pathfinderUrl: "https://pathfinder.aboutcircles.com",
  v1HubAddress: "0x29b9a7fbb8995b2423a71cc17cf9810798f6c543",
  v2HubAddress: "0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8",
  nameRegistryAddress: "0xA27566fD89162cC3D40Cb59c87AAaA49B85F3474",
  migrationAddress: "0xD44B8dcFBaDfC78EA64c55B705BFc68199B56376",
  profileServiceUrl: "https://rpc.aboutcircles.com/profiles/",
};

// Chiado testnet configuration for development
export const chiadoConfig: CirclesConfig = {
  circlesRpcUrl: "https://chiado-rpc.aboutcircles.com",
  pathfinderUrl: "https://chiado-pathfinder.aboutcircles.com",
  profileServiceUrl: "https://chiado-pathfinder.aboutcircles.com/profiles/",
  v1HubAddress: "0xdbf22d4e8962db3b2f1d9ff55be728a887e47710",
  v2HubAddress: "0x4A8aE9B6E7b16F14A8e96eb9C6CA8dEd7dA98C42",
  nameRegistryAddress: "0x1871EB96c3c1e75a9C46a20e0C10d92b7cA32b5B",
  migrationAddress: "0x3b45e9C9A49E1b9C7BAf091c5e7C5785C51E6Ce5",
  baseGroupMintPolicy: "0x7bDf37C6c47e8A77d32b2b3B4E8B2c9d4c9a1234",
};

// Use testnet by default for development
export const circlesConfig = "production";
//process.env.NODE_ENV === "production" ? gnosisChainConfig : chiadoConfig;
