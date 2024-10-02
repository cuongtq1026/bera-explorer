import AddressLink from "@components/AddressLink.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@components/ui/table.tsx";
import { findTransaction } from "@database/repositories/transaction.repository.ts";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { shortenEthAddress } from "@utils";
import dayjs from "dayjs";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUnits, type Hash, isHash } from "viem";

async function getTransaction(transactionHash: Hash) {
  return findTransaction(transactionHash, {
    withReceipt: true,
    withBlock: true,
    withTransfers: true,
  });
}

const TransactionPage = async ({ params }: { params: { hash: string } }) => {
  const hash = params.hash;
  if (!hash || !isHash(hash)) {
    notFound();
  }
  const transaction = await getTransaction(hash);
  if (!transaction || !transaction.receipt || !transaction.block) {
    notFound();
  }

  const gasPrice = transaction.gasPrice ?? 0n;
  const createdDate = dayjs(Number(transaction.block.createdAt) * 1000);
  return (
    <div>
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Transaction Hash</TableCell>
            <TableCell>{transaction.hash}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Status</TableCell>
            <TableCell>
              <div
                className={
                  "bg-gray-600 p-1 rounded-lg text-white text-sm flex gap-2 w-28 items-center justify-center"
                }
              >
                <CheckCircle className={"w-5"} />
                {transaction.receipt.status ? "Success" : "Failed"}
              </div>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Block</TableCell>
            <TableCell>
              <Link
                className={"hover:text-blue-500"}
                href={`/block/${transaction.blockNumber.toString()}`}
              >
                {transaction.blockNumber.toString()}
              </Link>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Timestamp</TableCell>
            <TableCell>
              <div>
                {createdDate.fromNow()} ({createdDate.toString()})
              </div>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>From</TableCell>
            <TableCell>
              <AddressLink address={transaction.from} />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>To</TableCell>
            <TableCell>
              {transaction.to && <AddressLink address={transaction.to} />}
            </TableCell>
          </TableRow>
          {transaction.transfers ? (
            <TableRow>
              <TableCell>ERC-20 Tokens Transferred</TableCell>
              <TableCell>
                {transaction.transfers.map((transfer) => {
                  return (
                    <div
                      className={"flex gap-1 items-center"}
                      key={transfer.hash}
                    >
                      <ChevronRightIcon />
                      From <AddressLink
                        address={transfer.from}
                        shorten
                      /> To <AddressLink address={transfer.to} shorten /> For{" "}
                      {formatUnits(transfer.amount, 18)}
                      <span className={"font-semibold"}>
                        ({shortenEthAddress(transfer.tokenAddress)})
                      </span>
                    </div>
                  );
                })}
              </TableCell>
            </TableRow>
          ) : undefined}
          <TableRow>
            <TableCell>Value</TableCell>
            <TableCell>{transaction.value?.toString()} ETH</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Transaction Fee</TableCell>
            <TableCell>
              {formatUnits(transaction.receipt.gasUsed * gasPrice, 18)} ETH
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Gas Price</TableCell>
            <TableCell>
              {gasPrice.toString()} Gwei {formatUnits(gasPrice, 18)} ETH
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Gas Limit & Used by Txn</TableCell>
            <TableCell>
              {transaction.block.gasLimit.toLocaleString()} |{" "}
              {transaction.receipt.gasUsed.toLocaleString()} (
              {(
                Number(transaction.receipt.gasUsed) /
                (Number(transaction.block.gasLimit) / 100)
              ).toFixed(2)}
              %)
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Nonce</TableCell>
            <TableCell>{transaction.nonce.toString()}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Input</TableCell>
            <TableCell>
              <div
                className={
                  "p-2 bg-gray-300 rounded border border-gray-600 break-all"
                }
              >
                {transaction.input}
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default TransactionPage;
