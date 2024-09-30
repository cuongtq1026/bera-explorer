import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table.tsx";
import { findInternalTransactions } from "@database/repositories/internal-transaction.repository.ts";
import {
  ArrowRightCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/16/solid";
import { is0xHash } from "@utils";
import { notFound } from "next/navigation";
import { type Hash } from "viem";

async function getInternalTransactions(transactionHash: Hash) {
  return findInternalTransactions(transactionHash);
}

const InternalTransactionPage = async ({
  params,
}: {
  params: { hash: string };
}) => {
  const { hash } = params;
  if (!is0xHash(hash)) {
    notFound();
  }
  const internalTransactions = await getInternalTransactions(hash);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type Trace Address</TableHead>
            <TableHead>From</TableHead>
            <TableHead></TableHead>
            <TableHead>To</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Gas</TableHead>
            <TableHead>Gas Used</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {internalTransactions.map((internalTransaction) => {
            return (
              <TableRow key={internalTransaction.hash}>
                <TableCell>
                  <div className={"flex gap-1"}>
                    <CheckCircleIcon className={"w-5 text-green-500"} />
                    <span>{internalTransaction.type}</span>
                    <span>({internalTransaction.input.slice(0, 10)})</span>
                  </div>
                </TableCell>
                <TableCell>{internalTransaction.from}</TableCell>
                <TableCell className={"justify-center flex"}>
                  <ArrowRightCircleIcon className={"w-5 text-green-500"} />
                </TableCell>
                <TableCell>{internalTransaction.to}</TableCell>
                <TableCell>
                  {internalTransaction.value.toLocaleString()} wei
                </TableCell>
                <TableCell>
                  {internalTransaction.gas.toLocaleString()}
                </TableCell>
                <TableCell>
                  {internalTransaction.gasUsed.toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default InternalTransactionPage;
