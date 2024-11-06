export default [
  {
    type: "constructor",
    inputs: [
      {
        name: "_tokenId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "minter",
        type: "address",
        internalType: "address",
      },
      {
        name: "_beraCopyNFT",
        type: "address",
        internalType: "contract BeraCopyNFT",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "DEFAULT_ADMIN_ROLE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MINTER_ROLE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "beraCopyNFT",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract BeraCopyNFT",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRoleAdmin",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "grantRole",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "hasRole",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isMinter",
    inputs: [],
    outputs: [
      {
        name: "result",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isNFTOwner",
    inputs: [],
    outputs: [
      {
        name: "result",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "multiSwap",
    inputs: [
      {
        name: "dex",
        type: "address",
        internalType: "contract IBeraCrocMultiSwap",
      },
      {
        name: "_steps",
        type: "tuple[]",
        internalType: "struct IBeraCrocMultiSwap.SwapStep[]",
        components: [
          {
            name: "poolIdx",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "base",
            type: "address",
            internalType: "address",
          },
          {
            name: "quote",
            type: "address",
            internalType: "address",
          },
          {
            name: "isBuy",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
      {
        name: "_amount",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "_minOut",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    outputs: [
      {
        name: "out",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "previewMultiSwap",
    inputs: [
      {
        name: "dex",
        type: "address",
        internalType: "contract IBeraCrocMultiSwap",
      },
      {
        name: "_steps",
        type: "tuple[]",
        internalType: "struct IBeraCrocMultiSwap.SwapStep[]",
        components: [
          {
            name: "poolIdx",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "base",
            type: "address",
            internalType: "address",
          },
          {
            name: "quote",
            type: "address",
            internalType: "address",
          },
          {
            name: "isBuy",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
      {
        name: "_amount",
        type: "uint128",
        internalType: "uint128",
      },
    ],
    outputs: [
      {
        name: "out",
        type: "uint128",
        internalType: "uint128",
      },
      {
        name: "predictedQty",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceRole",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "callerConfirmation",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeRole",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setBeraCopyNFT",
    inputs: [
      {
        name: "addr",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "supportsInterface",
    inputs: [
      {
        name: "interfaceId",
        type: "bytes4",
        internalType: "bytes4",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenId",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CopyTrade",
    inputs: [
      {
        name: "dex",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "out",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RoleAdminChanged",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "previousAdminRole",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "newAdminRole",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RoleGranted",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "sender",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RoleRevoked",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "sender",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AccessControlBadConfirmation",
    inputs: [],
  },
  {
    type: "error",
    name: "AccessControlUnauthorizedAccount",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
      {
        name: "neededRole",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
  },
  {
    type: "error",
    name: "CallerRestricted",
    inputs: [
      {
        name: "caller",
        type: "address",
        internalType: "address",
      },
    ],
  },
] as const;
