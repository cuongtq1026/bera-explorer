import AddressLink from "@components/AddressLink.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table.tsx";
import prisma from "@database/prisma.ts";
import { findBalances } from "@database/repositories/balance.repository.ts";
import dayjs from "dayjs";
import { notFound } from "next/navigation";
import { formatUnits, isHex } from "viem";

async function getAddress(address: string) {
  const balances = await findBalances(address);
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ from: address }, { to: address }],
    },
    include: {
      receipt: {
        select: {
          gasUsed: true,
        },
      },
      block: {
        select: {
          createdAt: true,
        },
      },
    },
    orderBy: [
      {
        blockNumber: "desc",
      },
      {
        transactionIndex: "desc",
      },
    ],
    take: 20,
  });

  return {
    balances,
    transactions,
  };
}

const AddressPage = async ({ params }: { params: { hash: string } }) => {
  const hash = params.hash?.toLowerCase();
  if (!hash || !isHex(hash)) {
    notFound();
  }

  const { balances, transactions } = await getAddress(hash);
  const ethBalance = BigInt(
    balances.find((balance) => balance.address === "")?.amount.toFixed() ?? 0,
  ).toString();

  return (
    <div className={"grid gap-4"}>
      <div className={"p-3 bg-gray-200 rounded grid gap-2"}>
        <div className={"font-semibold"}>Overview</div>
        <div>Balance: {ethBalance} ETH</div>
        {balances.length > 0 && (
          <div className={"p-2 border border-black rounded"}>
            <div>Tokens:</div>
            <div>
              {balances.map((balance) => (
                <div key={balance.tokenAddress} className={"flex gap-2"}>
                  <AddressLink address={balance.tokenAddress} type={"token"} />
                  <span>
                    {formatUnits(BigInt(balance.amount.toFixed()), 18)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Txn Hash</TableHead>
            <TableHead>Block</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Txn Fee</TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const gasUsed = transaction.receipt?.gasUsed ?? 0n;
            const gasPrice = transaction.gasPrice ?? 0n;
            const fee = gasUsed * gasPrice;

            return (
              <TableRow key={transaction.hash}>
                <TableCell>
                  <AddressLink
                    address={transaction.hash}
                    shorten
                    type={"transaction"}
                  />
                </TableCell>
                <TableCell>
                  <AddressLink
                    address={transaction.blockNumber.toString()}
                    type={"block"}
                  />
                </TableCell>
                <TableCell>
                  <AddressLink
                    address={transaction.from}
                    shorten
                    type={"address"}
                  />
                </TableCell>
                <TableCell>
                  {transaction.to && (
                    <AddressLink
                      address={transaction.to}
                      shorten
                      type={"address"}
                    />
                  )}
                </TableCell>
                <TableCell>{transaction.value?.toString() ?? "0"}</TableCell>
                <TableCell>{formatUnits(fee, 18)}</TableCell>
                <TableCell>
                  {dayjs(Number(transaction.block.createdAt) * 1000).fromNow()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default AddressPage;
