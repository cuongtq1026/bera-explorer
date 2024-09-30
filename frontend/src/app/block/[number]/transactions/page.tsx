import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@components/ui/breadcrumb.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table.tsx";
import { findBlock } from "@database/repositories/block.repository.ts";
import { ArrowRightCircleIcon } from "@heroicons/react/16/solid";
import { parseToBigInt, shortenEthAddress } from "@utils";
import dayjs from "dayjs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUnits } from "viem";

async function getBlock(blockNumber: bigint) {
  return findBlock(blockNumber, {
    withTransactions: true,
  });
}

const BlockTransactionPage = async ({
  params,
}: {
  params: { number: string };
}) => {
  const number = params.number;
  if (!number) {
    notFound();
  }
  const block = await getBlock(parseToBigInt(params.number));
  if (!block) {
    notFound();
  }
  return (
    <div className={"grid gap-2"}>
      <Breadcrumb>
        <BreadcrumbList className={"text-2xl font-bold"}>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/blocks">Blocks</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>#{number}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={"w-24"}>Txn Hash</TableHead>
            <TableHead>Block</TableHead>
            <TableHead className={"w-24"}>From</TableHead>
            <TableHead></TableHead>
            <TableHead className={"w-24"}>To</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Txn Fee</TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        {block.transactions && (
          <TableBody>
            {block.transactions.map((transaction) => {
              const gasUsed = transaction.receipt?.gasUsed || 0n;
              const gasPrice = transaction.gasPrice || 0n;
              const txnFee = gasUsed * gasPrice;
              const createdDate = dayjs(Number(block.createdAt) * 1000);
              return (
                <TableRow key={transaction.hash}>
                  <TableCell title={transaction.hash}>
                    <Link
                      href={`/transaction/${transaction.hash}`}
                      className={"hover:text-blue-500"}
                    >
                      {shortenEthAddress(transaction.hash)}
                    </Link>
                  </TableCell>
                  <TableCell>{transaction.blockNumber.toString()}</TableCell>
                  <TableCell title={transaction.from}>
                    {shortenEthAddress(transaction.from)}
                  </TableCell>
                  <TableCell className={"justify-center flex"}>
                    <ArrowRightCircleIcon className={"w-5 text-green-500"} />
                  </TableCell>
                  <TableCell title={transaction.to ?? ""}>
                    {shortenEthAddress(transaction.to)}
                  </TableCell>
                  <TableCell>{transaction.value?.toString() || 0}</TableCell>
                  <TableCell>
                    {Number(formatUnits(txnFee, 18)).toFixed(8)}
                  </TableCell>
                  <TableCell>{createdDate.fromNow()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        )}
      </Table>
    </div>
  );
};

export default BlockTransactionPage;
