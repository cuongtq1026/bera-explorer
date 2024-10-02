import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@components/ui/breadcrumb.tsx";
import { Button } from "@components/ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@components/ui/table.tsx";
import { findBlock } from "@database/repositories/block.repository.ts";
import { parseToBigInt } from "@utils";
import dayjs from "dayjs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUnits } from "viem";

async function getBlock(blockNumber: bigint) {
  return findBlock(blockNumber, {
    withTransactions: true,
    count: true,
  });
}

const BlockPage = async ({ params }: { params: { number: string } }) => {
  const number = params.number;
  if (!number) {
    notFound();
  }
  const block = await getBlock(parseToBigInt(params.number));
  if (!block) {
    notFound();
  }
  const gasUsedPercent = Number(block.gasUsed) / (Number(block.gasLimit) / 100);
  const txsFees =
    block.transactions?.reduce((acc, curr) => {
      const gasUsed = curr.receipt?.gasUsed || 0n;
      const gasPrice = curr.gasPrice || 0n;
      return acc + gasUsed * gasPrice;
    }, 0n) || 0n;
  const createdDate = dayjs(Number(block.createdAt) * 1000);
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
        <TableBody>
          <TableRow>
            <TableCell className={"w-60"}>Block Height</TableCell>
            <TableCell>{block.number.toString()}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className={"w-60"}>Timestamp</TableCell>
            <TableCell>
              {createdDate.fromNow()} ({createdDate.toString()})
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className={"w-60"}>Transactions</TableCell>
            <TableCell>
              <Link href={`/block/${params.number}/transactions`}>
                <Button variant={"secondary"}>
                  {block?.transactions?.length ?? 0} transactions
                </Button>
              </Link>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className={"w-60"}>Block Fees</TableCell>
            <TableCell>{formatUnits(txsFees, 18)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className={"w-60"}>Gas Used</TableCell>
            <TableCell>
              {block.gasUsed.toLocaleString()} ({gasUsedPercent.toFixed(2)}%)
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className={"w-60"}>Gas Limit</TableCell>
            <TableCell>{block.gasLimit.toLocaleString()}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default BlockPage;
