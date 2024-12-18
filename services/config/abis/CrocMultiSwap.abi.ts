export default [
  {
    type: "constructor",
    inputs: [
      {
        name: "_crocSwapDex",
        type: "address",
        internalType: "address",
      },
      {
        name: "_crocImpact",
        type: "address",
        internalType: "address",
      },
      {
        name: "_crocQuery",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "receive",
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "crocSwapDex",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract CrocSwapDex",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "multiSwap",
    inputs: [
      {
        name: "_steps",
        type: "tuple[]",
        internalType: "struct SwapHelpers.SwapStep[]",
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
        name: "_steps",
        type: "tuple[]",
        internalType: "struct SwapHelpers.SwapStep[]",
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
    name: "retire",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
